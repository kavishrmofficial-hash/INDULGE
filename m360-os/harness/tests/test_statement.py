#!/usr/bin/env python3
"""The Bank tab in Books: a current account statement read line by line, money in as income, money out grouped by
party with a total each (every Starbucks line together, Soho House and Junco Hospitality under one name), a search,
an owner's edit to a party that sticks, the lines into Expenses once, and a statement removed. On the team site a
PDF is read two pages at a time on the server and the parties are named there.

Run: cd m360-os && python3 harness/tests/test_statement.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

SHOTS = os.environ.get('STM_SHOTS') or os.path.join(ROOT, 'harness', 'shots')

CSV = '\n'.join([
    'Tran Date,Particulars,Chq No,Debit,Credit,Balance',
    '02-09-2026,UPI/STARBUCKS COFFEE/412233/Payment,,450.00,,100000.00',
    '05-09-2026,NEFT CR-TITAN COMPANY LTD-INV 118,,,295000.00,395000.00',
    '07-09-2026,POS 4417XXXXXXXX0412 STARBUCKS COFFEE 0412,,380.00,,394620.00',
    '10-09-2026,POS JUNCO HOSPITALITY PVT LTD,,18500.00,,376120.00',
    '12-09-2026,UPI/SOHO HOUSE MUMBAI/998877/dinner,,6200.00,,369920.00',
    '15-09-2026,UPI/STARBUCKS/556677/coffee,,520.00,,369400.00',
    '18-09-2026,NEFT CR-SWISSE WELLNESS-RETAINER,,,150000.00,519400.00',
    '20-09-2026,ACH D- ADOBE SYSTEMS SOFTWARE,,4999.00,,514401.00',
])


def artifact_part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#books', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#statement', width=1280)
    p.wait_for_selector('#stm-upload')
    check(p.locator('.tabs :text-is("Bank"), [role=tablist] :text-is("Bank"), button:text-is("Bank")').count() >= 1, 'the Bank tab is not in Books')
    # the helpers: one key per business
    keys = p.evaluate('["STARBUCKS COFFEE 0412", "Starbucks", "Junco Hospitality Pvt Ltd"].map(M.statement.keyOf)')
    check(keys[1] == 'starbucks' and keys[2] == 'juncohospitality', 'keys: %r' % keys)
    alias = p.evaluate('M.statement.aliasMap(["starbuckscoffee", "starbucks", "adobe"])')
    check(alias.get('starbuckscoffee') == 'starbucks', 'alias: %r' % alias)
    check(p.evaluate('M.statement.pdfPages(new TextEncoder().encode("1 0 obj << /Type /Pages /Kids [3 0 R] /Count 7 >> endobj").buffer)') == 7, 'pdf page count')
    p.fill('#stm-bank', 'Axis current')
    p.set_input_files('#stm-file', files=[{'name': 'axis-sep.csv', 'mimeType': 'text/csv', 'buffer': CSV.encode()}])
    p.wait_for_selector('#stm-kpis', timeout=20000)
    p.wait_for_function('() => /Read 8 lines/.test((document.querySelector("#stm-line") || {}).textContent || "")', timeout=20000)
    check(p.inner_text('#stm-in').replace(',', '').find('445000') >= 0 or '4,45,000' in p.inner_text('#stm-in'), 'money in: %r' % p.inner_text('#stm-in'))
    check('31,049' in p.inner_text('#stm-out'), 'money out: %r' % p.inner_text('#stm-out'))
    outs = p.evaluate('() => [...document.querySelectorAll("#stm-outs tr.stm-row")].map(r => [r.dataset.party, r.children[1].innerText.trim(), r.children[2].innerText.trim()])')
    byName = {o[0]: o for o in outs}
    check('Starbucks' in byName and byName['Starbucks'][1] == '3' and '1,350' in byName['Starbucks'][2], 'starbucks grouped: %r' % outs)
    check('Soho House' in byName and byName['Soho House'][1] == '2' and '24,700' in byName['Soho House'][2], 'soho house and junco grouped: %r' % outs)
    check(outs and outs[0][0] == 'Soho House', 'sorted by total: %r' % outs)
    ins = p.evaluate('() => [...document.querySelectorAll("#stm-ins tr.stm-row")].map(r => r.dataset.party)')
    check(len(ins) == 2, 'money in parties: %r' % ins)
    check('Meals and client' in p.inner_text('#stm-cats'), 'category rail: %r' % p.inner_text('#stm-cats'))
    # search narrows the view
    p.fill('#stm-q', 'adobe')
    p.wait_for_timeout(200)
    check(p.locator('#stm-outs tr.stm-row').count() == 1 and '4,999' in p.inner_text('#stm-out'), 'search: %r' % p.inner_text('#stm-out'))
    p.fill('#stm-q', '')
    p.wait_for_timeout(200)
    # the same file again adds nothing
    p.set_input_files('#stm-file', files=[{'name': 'axis-sep.csv', 'mimeType': 'text/csv', 'buffer': CSV.encode()}])
    p.wait_for_function('() => /already here/.test((document.querySelector("#stm-line") || {}).textContent || "")', timeout=20000)
    check(p.evaluate('Object.keys(M.lastCtx.coll.statements.map).filter(k => k !== "_parties").length') == 1, 'a repeat upload made a second statement')
    # the owner renames a party and it sticks
    p.locator('#stm-outs tr.stm-row[data-party="Adobe Systems Software"] button:has-text("Edit"), #stm-outs tr.stm-row:has-text("Adobe") button:has-text("Edit")').first.click()
    p.wait_for_selector('#stm-party')
    p.fill('#stm-party-label', 'Adobe')
    p.click('#stm-party-save')
    p.wait_for_function('() => [...document.querySelectorAll("#stm-outs tr.stm-row")].some(r => r.dataset.party === "Adobe")')
    book = p.evaluate('M.lastCtx.coll.statements.map._parties.map')
    check(any(v.get('label') == 'Adobe' and v.get('by') == 'you' for v in book.values()), 'party edit saved: %r' % list(book.values())[:3])
    # into Expenses once
    p.click('#stm-to-exp')
    p.wait_for_function('() => M.books.expenses(M.lastCtx).filter(e => e.source === "statement").length === 6', timeout=10000)
    p.wait_for_timeout(400)
    p.click('#stm-to-exp')
    p.wait_for_timeout(800)
    n = p.evaluate('M.books.expenses(M.lastCtx).filter(e => e.source === "statement").length')
    check(n == 6, 'expenses after two adds: %r' % n)
    os.makedirs(SHOTS, exist_ok=True)
    p.screenshot(path=os.path.join(SHOTS, 'statement-1280.png'), full_page=True)
    h.go(p, 'founder', hash='#statement', width=390)
    p.wait_for_selector('#stm-kpis')
    check(not h.overflow(p), 'the page scrolls sideways at 390')
    p.screenshot(path=os.path.join(SHOTS, 'statement-390.png'), full_page=True)
    h.go(p, 'founder', hash='#statement', width=1280)
    p.wait_for_selector('#stm-pick')
    sid = p.evaluate('Object.keys(M.lastCtx.coll.statements.map).find(k => k !== "_parties")')
    p.select_option('#stm-pick', sid)
    p.locator('#stm-actions button:has-text("Remove this statement")').click()
    p.locator('#stm-actions button:has-text("Tap again")').click()
    p.wait_for_function('() => Object.keys(M.lastCtx.coll.statements.map).filter(k => k !== "_parties").length === 0')
    # a member never reaches it
    h.go(p, 'm1', hash='#statement', width=1280)
    p.wait_for_timeout(600)
    check(p.locator('#stm-page').count() == 0, 'a member reached the Bank tab')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


def year_csv():
    """A full financial year, 3,600 lines with paise, over 200 KB: more than one statement document holds. Two
    Starbucks lines on 1 Apr are alike in date, amount and party (different UPI refs), and two Uber lines on 1 Apr
    are alike in every column: each is its own expense."""
    import datetime
    parties = [('UPI/STARBUCKS COFFEE/%06d/coffee', 1), ('POS UBER INDIA SYSTEMS %06d', 1), ('NEFT DR-KHAN PRODUCTION STUDIO-%06d', 1),
               ('ACH D- ADOBE SYSTEMS SOFTWARE %06d', 1), ('UPI/ZOMATO/%06d/lunch', 1), ('NEFT CR-TITAN COMPANY LTD-INV %06d', 0),
               ('NEFT CR-SWISSE WELLNESS-%06d', 0), ('UPI/SOHO HOUSE MUMBAI/%06d/dinner', 1)]
    rows, out_total, in_total, n_out = [], 0, 0, 0
    d0 = datetime.date(2025, 4, 1)
    for i in range(3600):
        day = d0 + datetime.timedelta(days=i * 365 // 3600)
        narr, debit = parties[i % len(parties)]
        paise = 100000 + (i * 7919) % 900000
        if i in (0, 8):
            narr, paise = 'UPI/STARBUCKS COFFEE/%06d/coffee', 42000
        if i in (1, 9):
            narr, paise = 'POS UBER INDIA SYSTEMS 000777', 64000
        amt = '%d.%02d' % (paise // 100, paise % 100)
        nar = narr % (500000 + i) if '%' in narr else narr
        rows.append('%s,%s,,%s,%s,0.00' % (day.strftime('%d-%m-%Y'), nar, amt if debit else '', '' if debit else amt))
        if debit:
            out_total += paise; n_out += 1
        else:
            in_total += paise
    return '\n'.join(['Tran Date,Particulars,Chq No,Debit,Credit,Balance'] + rows), out_total, in_total, n_out


def year_part(k, base, store):
    """books-2, books-4 and books-5 on the team site: the year splits into statements/<id>.p2 and reads back with
    exact totals, every money out line lands in Expenses once, and a renamed party adds nothing on a second press."""
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    csv, out_total, in_total, n_out = year_csv()
    check(len(csv) > 200000, 'the year is too small to split: %d bytes' % len(csv))
    k.goto(base + '#statement'); k.wait_for_selector('#stm-file', state='attached')
    k.fill('#stm-bank', 'Axis FY')
    k.set_input_files('#stm-file', files=[{'name': 'fy2025.csv', 'mimeType': 'text/csv', 'buffer': csv.encode()}])
    k.wait_for_function('() => /Read 3600 lines|bad path|Could not/.test((document.querySelector("#stm-line") || {}).textContent || "")', timeout=120000)
    line = k.inner_text('#stm-line')
    check('Read 3600 lines' in line, 'the year: %r' % line)
    k.wait_for_timeout(1500)
    k.reload(); k.wait_for_selector('#stm-pick', timeout=30000)
    k.wait_for_timeout(1500)
    sid = k.evaluate('() => (M.statement.readAll(M.lastCtx).list.find(s => s.name === "fy2025.csv") || {}).id')
    check(bool(sid), 'the year is not in the picker after a reload')
    if not sid:
        return fails
    docs = k.evaluate('(sid) => Object.keys(M.lastCtx.coll.statements.map).filter(x => x === sid || x.startsWith(sid + "."))', sid)
    check(sid + '.p2' in docs and not any('~' in d for d in docs), 'the parts: %r' % docs)
    back = k.evaluate('''(sid) => { const s = M.statement.readAll(M.lastCtx).list.find(x => x.id === sid);
        return {n: s.rows.length, out: Math.round(s.rows.reduce((t, r) => t + r.out, 0) * 100), inn: Math.round(s.rows.reduce((t, r) => t + r.inn, 0) * 100), parts: s.parts}; }''', sid)
    check(back['n'] == 3600 and back['out'] == out_total and back['inn'] == in_total and back['parts'] >= 2,
          'read back: %r, want 3600 lines, out %d, in %d paise' % (back, out_total, in_total))
    k.select_option('#stm-pick', sid); k.wait_for_timeout(500)
    want_out = '{:,}'.format(round(out_total / 100))
    kpi = k.inner_text('#stm-out').replace(',', '')
    check(kpi.endswith(str(round(out_total / 100))), 'money out for the year: %r, want %s' % (k.inner_text('#stm-out'), want_out))
    # every money out line into Expenses, alike lines included
    year = 'M.books.expenses(M.lastCtx).filter(e => e.source === "statement" && e.date >= "2025-04-01" && e.date <= "2026-03-31")'
    k.click('#stm-to-exp')
    k.wait_for_function('() => ' + year + '.length >= ' + str(n_out), timeout=60000)
    k.wait_for_timeout(800)
    got = k.evaluate('() => { const xs = ' + year + '; return {n: xs.length, sum: Math.round(xs.reduce((t, e) => t + e.amount, 0) * 100)}; }')
    check(got == {'n': n_out, 'sum': out_total}, 'expenses for the year: %r, want %d lines and %d paise' % (got, n_out, out_total))
    # rename a party, press again: nothing new
    k.locator('#stm-outs tr.stm-row:has-text("Starbucks") button:has-text("Edit")').first.click()
    k.wait_for_selector('#stm-party')
    k.fill('#stm-party-label', 'Coffee runs')
    k.click('#stm-party-save')
    k.wait_for_function('() => [...document.querySelectorAll("#stm-outs tr.stm-row")].some(r => r.dataset.party === "Coffee runs")')
    k.click('#stm-to-exp')
    k.wait_for_timeout(2500)
    again = k.evaluate('() => ' + year + '.length')
    check(again == n_out, 'a renamed party was added again: %d expenses, want %d' % (again, n_out))
    return fails


def standalone_part():
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    build_edgeone.main()
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    store = tempfile.mktemp(suffix='.json')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store],
                           env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = 'http://localhost:%d/' % port
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(base, timeout=1); break
            except Exception:
                time.sleep(0.1)
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            exe = os.environ.get('PW_CHROMIUM')
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
            k = browser.new_context(viewport={'width': 1280, 'height': 900}, timezone_id='Asia/Kolkata').new_page(); k.set_default_timeout(20000)
            k.add_init_script('window.M360_WELCOME_OFF = true; window.M360_MONEY_LOCK_OFF = true')
            k.goto(base); k.wait_for_selector('#signin-name')
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'books-test-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(600)
            # the server reads a page window and names parties
            pdf = b'%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R 4 0 R] /Count 3 >> endobj\n%%EOF'
            r = k.evaluate('(d) => window.M360_API("bookstatement", {name: "s.pdf", type: "application/pdf", data: d, pageFrom: 3, pageTo: 4})', __import__('base64').b64encode(pdf).decode())
            check(r['pages'] == 3 and len(r['rows']) == 2 and r['rows'][0]['vendor'] == 'Junco Hospitality' and r['rows'][0]['amount'] == 18500, 'window 3 to 4: %r' % r)
            calls = json.loads(urllib.request.urlopen(base + '__ai').read())
            st = [c for c in calls if c['system'].startswith('BOOKS STATEMENT')]
            check(st and st[-1]['model'] == 'claude-haiku-5-5', 'statement model: %r' % [c['model'] for c in st])
            k.goto(base + '#statement'); k.wait_for_selector('#stm-file', state='attached')
            k.set_input_files('#stm-file', files=[{'name': 'axis-fy.pdf', 'mimeType': 'application/pdf', 'buffer': pdf}])
            k.wait_for_function('() => /Read 6 lines/.test((document.querySelector("#stm-line") || {}).textContent || "")', timeout=60000)
            outs = k.evaluate('() => [...document.querySelectorAll("#stm-outs tr.stm-row")].map(r => [r.dataset.party, r.children[1].innerText.trim(), r.children[2].innerText.trim(), r.innerText])')
            by = {o[0]: o for o in outs}
            check('Soho House' in by and '18,500' in by['Soho House'][2], 'soho house on the team site: %r' % outs)
            check('Starbucks' in by and by['Starbucks'][1] == '2' and '800' in by['Starbucks'][2] and 'Meals and client' in by['Starbucks'][3], 'starbucks on the team site: %r' % outs)
            check('2,95,000' in k.inner_text('#stm-in'), 'money in on the team site: %r' % k.inner_text('#stm-in'))
            calls = json.loads(urllib.request.urlopen(base + '__ai').read())
            check(any(c['system'].startswith('BOOKS PARTIES') for c in calls), 'no party call')
            wins = [c for c in calls if c['system'].startswith('BOOKS STATEMENT')]
            check(len(wins) >= 3, 'the PDF should be read in windows: %d calls' % len(wins))
            fails.extend(year_part(k, base, store))
            browser.close()
    finally:
        srv.terminate()
    return fails


def main():
    fails = run(artifact_part)
    fails = list(fails or []) + standalone_part()
    if fails:
        for f in fails:
            print('FAIL', f)
        sys.exit(1)
    print('PASS')


if __name__ == '__main__':
    main()
