#!/usr/bin/env python3
"""The books, the owner's accounting and HR desk: setup, a client's billing profile, an invoice with
its number, GST split and words, mark sent, a payment, the overdue inbox line and badge, the retainer
draft the page writes by itself, expenses, a payroll run with a payslip, an issued offer letter, and a
member who sees none of it. On the team site: the server mails an invoice, drafts the retainer and
sends the auto-chase reminder.

Run: cd m360-os && python3 harness/tests/test_books.py
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import build_edgeone  # noqa: E402
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

CLIENT = 'swisse-wellness-uae'
GOOGLE_CLIENT = '1234567890-abcdefg.apps.googleusercontent.com'


def artifact_part(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, hash='#books', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'founder', hash='#books', width=1280)
    p.wait_for_selector('#books-calls')
    today = p.evaluate('M.U.todayStr()')
    fy = p.evaluate('M.books.fyOf(M.U.todayStr())')
    mid = today[:7]
    check(p.locator('.sidebar a:has-text("Books"), .sidebar button:has-text("Books")').count() >= 1, 'Books is not in the owner nav')
    # words and money
    check(p.evaluate('M.books.words(295000, "INR")') == 'Two Lakh Ninety Five Thousand Rupees Only', 'words: %r' % p.evaluate('M.books.words(295000, "INR")'))
    check(p.evaluate('M.books.money(1234567.5, "INR")') == '₹12,34,567.50', 'money: %r' % p.evaluate('M.books.money(1234567.5, "INR")'))
    check(p.evaluate('M.books.words(1500.25, "USD")') == 'One Thousand Five Hundred Dollars and Twenty Five Cents Only', 'usd words: %r' % p.evaluate('M.books.words(1500.25, "USD")'))
    check(p.evaluate('M.books.words(99.5, "INR")') == 'Ninety Nine Rupees and Fifty Paise Only', 'paise words: %r' % p.evaluate('M.books.words(99.5, "INR")'))
    check(p.evaluate('M.books.words(12500000, "INR")') == 'One Crore Twenty Five Lakh Rupees Only', 'crore words: %r' % p.evaluate('M.books.words(12500000, "INR")'))
    # setup: change the GSTIN and save
    h.go(p, 'founder', hash='#billing', width=1280)
    p.wait_for_selector('#books-save')
    gstin = p.get_by_label('GSTIN, blank when not registered')
    gstin.fill('27DGFPR0438M1ZV')
    p.click('#books-save')
    p.wait_for_function('() => { const d = window.__db.get("books/settings"); return d && d.company && d.company.gstin === "27DGFPR0438M1ZV"; }')
    # the clients' billing table sits at the top of Setup; a client opens as a full page, drafted from what m360 knows
    p.wait_for_selector('#billing-table')
    check('new' in p.inner_text('#billing-table .billing-row').lower(), 'a client without a profile should read as new')
    p.click('#billing-table .billing-row:has-text("Swisse Wellness UAE")')
    p.wait_for_selector('#billing-page')
    check(p.input_value('#billing-legal') == 'Swisse Wellness UAE' and p.input_value('#billing-code') == 'SWU', 'the draft profile: %r %r' % (p.input_value('#billing-legal'), p.input_value('#billing-code')))
    check(p.locator('#billing-mine:has-text("team site")').count() == 1, 'the mail reader should say it works on the team site')
    p.fill('#billing-code', 'SW')
    p.fill('#billing-legal', 'Swisse Wellness Middle East FZ LLC')
    p.fill('#billing-taxid', '27AABCS1234A1Z5')
    p.fill('#billing-contact', 'Priya Rao')
    p.fill('#billing-mail', 'ap@swisse.example')
    p.click('#billing-retainer-card [role=tablist][aria-label="Retainer"] [role=tab]:has-text("On")')
    p.fill('#billing-retainer', '250000')
    p.click('#billing-save')
    p.wait_for_function('() => { const d = window.__db.get("books/clients"); return d && d.map && d.map["%s"] && d.map["%s"].retainer.active && d.map["%s"].code === "SW"; }' % (CLIENT, CLIENT, CLIENT))
    p.click('#billing-back')
    p.wait_for_selector('#billing-table')
    check('ready' in p.inner_text('#billing-table .billing-row').lower() and 'ap@swisse.example' in p.inner_text('#billing-table'), 'the table should show the saved profile: ' + p.inner_text('#billing-table').replace(chr(10), ' | ')[:200])
    # an invoice from the profile: the number, the retainer line, the GST split
    h.go(p, 'founder', hash='#invoices', width=1280)
    p.wait_for_selector('#inv-new')
    p.click('#inv-new')
    p.wait_for_selector('#inv-drawer')
    p.select_option('#inv-client', CLIENT)
    p.wait_for_function('() => document.querySelector("#inv-no") && document.querySelector("#inv-no").value.endsWith("/SW-001")')
    no = p.input_value('#inv-no')
    check(no == 'MM/%s/SW-001' % fy, 'invoice number: %r' % no)
    check(p.input_value('#inv-line-rate-0') == '250000', 'retainer rate not carried: %r' % p.input_value('#inv-line-rate-0'))
    check(p.input_value('#inv-legal') == 'Swisse Wellness Middle East FZ LLC', 'legal name not carried')
    p.click('#inv-save')
    p.wait_for_function('() => { const d = window.__db.get("invoices/%s"); return d && Object.keys(d.rows || {}).length === 1; }' % fy)
    doc = p.evaluate('window.__db.get("invoices/%s")' % fy)
    iid = list(doc['rows'].keys())[0]
    row = doc['rows'][iid]
    t = p.evaluate('M.books.totals(%s)' % json.dumps(row))
    check(row['gst'] == 'intra' and t['cgst'] == 22500 and t['sgst'] == 22500 and t['total'] == 295000 and t['balance'] == 295000, 'totals: %r' % t)
    check(row['status'] == 'draft' and row['client'] == CLIENT, 'row: %r' % {k: row[k] for k in ('status', 'client')})
    # the document
    p.wait_for_selector('#invoice-doc')
    body = p.inner_text('#invoice-doc')
    check(p.locator('#invoice-doc .mark svg').count() == 1, 'the invoice should carry the logo')
    check('TAX INVOICE' in body.upper() and '2,95,000' in body and 'Two Lakh Ninety Five Thousand Rupees Only' in body and '27DGFPR0438M1ZV' in body and 'UTIB0000186' in body, 'invoice document: ' + body[:400].replace('\n', ' | '))
    # mark sent, then a part payment
    p.click('#inv-mark-sent')
    p.wait_for_function('() => window.__db.get("invoices/%s").rows["%s"].status === "sent"' % (fy, iid))
    p.click('#inv-pay')
    p.wait_for_selector('#inv-pay-drawer')
    p.fill('#inv-pay-amount', '100000')
    p.get_by_label('reference, UTR or cheque').fill('UTR123')
    p.click('#inv-pay-record')
    p.wait_for_function('() => (window.__db.get("invoices/%s").rows["%s"].payments || []).length === 1' % (fy, iid))
    row = p.evaluate('window.__db.get("invoices/%s").rows["%s"]' % (fy, iid))
    check(p.evaluate('M.books.status(%s, M.U.todayStr())' % json.dumps(row)) == 'part' and p.evaluate('M.books.totals(%s).balance' % json.dumps(row)) == 195000, 'part payment: %r' % row.get('payments'))
    check(p.locator('.pill:has-text("part paid")').count() >= 1, 'the invoice should wear a part paid pill')
    # overdue: the inbox line and the badge
    row['due'] = p.evaluate('M.U.ymd(M.U.addDays(M.U.parseYmd(M.U.todayStr()), -7))')
    doc['rows'][iid] = row
    h.seed_doc(p, 'invoices/%s' % fy, doc)
    p.wait_for_timeout(400)
    due = h.ctx(p, 'M.inbox.items(ctx).filter(i => i.id.startsWith("bkdue:")).map(i => i.text)')
    check(len(due) == 1 and '7 days past due' in due[0] and '1,95,000' in due[0], 'overdue inbox line: %r' % due)
    check(h.ctx(p, 'M.badges(ctx).books') == 1, 'books badge: %r' % h.ctx(p, 'M.badges(ctx).books'))
    # the page drafts the retainer by itself: the second number, this month's period, a draft
    p.wait_for_function('() => { const d = window.__db.get("invoices/%s"); return Object.values(d.rows).some(r => r && r.auto === "retainer"); }' % fy, timeout=30000)
    drafts = [r for r in p.evaluate('Object.values(window.__db.get("invoices/%s").rows)' % fy) if r and r.get('auto') == 'retainer']
    check(len(drafts) == 1 and drafts[0]['no'] == 'MM/%s/SW-002' % fy and drafts[0]['autoPeriod'] == mid and drafts[0]['status'] == 'draft' and drafts[0]['lines'][0]['rate'] == 250000, 'retainer draft: %r' % [(d['no'], d.get('autoPeriod'), d['status']) for d in drafts])
    p.wait_for_timeout(14000)
    drafts = [r for r in p.evaluate('Object.values(window.__db.get("invoices/%s").rows)' % fy) if r and r.get('auto') == 'retainer']
    check(len(drafts) == 1, 'the retainer was drafted %d times' % len(drafts))
    waiting = h.ctx(p, 'M.inbox.items(ctx).filter(i => i.id.startsWith("bkdraft:")).length')
    check(waiting == 1, 'the drafted retainer should wait in the inbox: %r' % waiting)
    # the list shows both, the filter narrows
    h.go(p, 'founder', hash='#invoices', width=1280)
    p.wait_for_selector('#inv-list')
    check(p.locator('#inv-list .inv-row').count() == 1, 'open invoices: %d' % p.locator('#inv-list .inv-row').count())
    p.click('[role=tablist][aria-label="Which invoices"] [role=tab]:text-is("All")')
    p.wait_for_timeout(200)
    check(p.locator('#inv-list .inv-row').count() == 2, 'all invoices: %d' % p.locator('#inv-list .inv-row').count())
    # expenses
    h.go(p, 'founder', hash='#expenses', width=1280)
    p.wait_for_selector('#exp-new')
    p.click('#exp-new')
    p.wait_for_selector('#exp-drawer')
    p.fill('#exp-vendor', 'Adobe')
    p.fill('#exp-amount', '4999')
    p.select_option('#exp-cat', 'Software and tools')
    p.locator('#exp-drawer').get_by_label('repeats').select_option('monthly')
    p.click('#exp-save')
    p.wait_for_function('() => { const d = window.__db.get("expenses/%s"); return d && Object.keys(d.rows || {}).length === 1; }' % mid)
    p.wait_for_function('() => Array.from(document.querySelectorAll("#exp-sheet input")).some(i => i.value === "Adobe")')
    check('4,999' in p.inner_text('#exp-cats'), 'by category card: ' + p.inner_text('#exp-cats'))
    # the sheet: type a second row straight into the blank cells and save
    p.fill('#exp-sheet input[data-r="1"][aria-label="paid to"]', 'The landlord')
    p.fill('#exp-sheet input[data-r="1"][aria-label="amount"]', '60000')
    p.wait_for_timeout(150)
    p.click('#exp-sheet-save')
    p.wait_for_function('() => { const d = window.__db.get("expenses/%s"); return d && Object.values(d.rows || {}).some(r => r && r.vendor === "The landlord" && r.amount === 60000); }' % mid)
    check(p.locator('#exp-import').count() == 1, 'the statement import button should be there')
    # payroll: pay for a member (professional tax on by default, PF off), the month, mark paid, the payslip
    h.go(p, 'founder', hash='#payroll', width=1280)
    p.wait_for_selector('#pay-edit-u_m1')
    body = p.inner_text('#pay-month-card').lower()
    check('prepare' not in body and 'run' not in body.split('salaries')[0] and 'close' not in body, 'the month card should not talk about runs: ' + body[:200])
    p.click('#pay-edit-u_m1')
    p.wait_for_selector('#pay-drawer')
    p.fill('#pay-ctc', '1200000')
    p.click('#pay-suggest')
    p.wait_for_function('() => Number(document.querySelector("#pay-basic").value) === 50000')
    check(p.locator('#pay-pf').count() == 0 and p.locator('#pay-pt').count() == 1 and p.input_value('#pay-pt') == '200', 'PF off and professional tax on by default: pf %d pt %r' % (p.locator('#pay-pf').count(), p.input_value('#pay-pt') if p.locator('#pay-pt').count() else None))
    net = p.inner_text('#pay-net')
    check('99,800' in net, 'net pay after the suggested split: %r' % net)
    p.click('#pay-save')
    p.wait_for_function('() => { const d = window.__db.get("payroll/salaries"); return d && d.map && d.map.u_m1 && d.map.u_m1.ctc === 1200000; }')
    p.wait_for_selector('#pay-lop-u_m1')
    absent = p.evaluate('() => M.payroll.attendance(M.lastCtx, "u_m1", M.U.todayStr().slice(0, 7)).absent')
    check(int(p.input_value('#pay-lop-u_m1') or 0) == absent, 'loss of pay should start at the days without attendance (%d): %r' % (absent, p.input_value('#pay-lop-u_m1')))
    p.fill('#pay-lop-u_m1', '0')
    p.wait_for_timeout(200)
    check('99,800' in p.inner_text('#pay-rows'), 'the month row should recompute with no loss of pay: ' + p.inner_text('#pay-rows')[:200])
    p.click('#pay-paid-u_m1')
    p.wait_for_function('() => { const d = window.__db.get("payroll/%s"); return d && d.run && d.run.rows && d.run.rows.u_m1 && d.run.rows.u_m1.paidAt; }' % mid)
    r = p.evaluate('window.__db.get("payroll/%s").run.rows.u_m1' % mid)
    check(r['gross'] == 100000 and r['net'] == 99800 and r['pt'] == 200 and r['lop'] == 0, 'payroll row: %r' % r)
    p.wait_for_function('() => { const d = window.__db.get("expenses/%s"); return d && d.rows && d.rows["payroll-%s"] && d.rows["payroll-%s"].amount === 99800; }' % (mid, mid, mid))
    p.click('#pay-slip-u_m1')
    p.wait_for_selector('#payslip-doc')
    slip = p.inner_text('#payslip-doc')
    check('Durvesh Patil' in slip and '99,800' in slip and 'Ninety Nine Thousand Eight Hundred Rupees Only' in slip and 'Professional tax' in slip and 'Provident' not in slip, 'payslip: ' + slip[:300].replace('\n', ' | '))
    check(p.locator('#payslip-doc .mark svg').count() == 1, 'the payslip should carry the logo')
    # letters: an offer letter for a member, saved and issued
    h.go(p, 'founder', hash='#letters/u_m1', width=1280)
    p.wait_for_selector('#letter-kind')
    p.select_option('#letter-kind', 'offer')
    p.click('#letter-draft')
    p.wait_for_selector('#letter-drawer')
    check(p.input_value('#letter-var-who') == 'Durvesh Patil', 'offer name: %r' % p.input_value('#letter-var-who'))
    check(p.input_value('#letter-var-ctc') == '1200000', 'offer ctc from payroll: %r' % p.input_value('#letter-var-ctc'))
    p.click('#letter-write')
    p.wait_for_function('() => (document.querySelector("#letter-body").value || "").includes("Twelve Lakh")')
    p.click('#letter-save')
    p.wait_for_function('() => { const d = window.__db.get("hr/u_m1"); return d && d.letters && Object.values(d.letters).some(l => l.status === "draft"); }')
    p.wait_for_selector('#letter-drawer', state='detached')
    p.click('#letters-list .listrow:has-text("Offer") button:has-text("Open")')
    p.wait_for_selector('#letter-issue button')
    p.click('#letter-issue button')
    p.click('#letter-issue button:has-text("Tap again")')
    p.wait_for_function('() => { const d = window.__db.get("hr/u_m1"); return d && d.letters && Object.values(d.letters).some(l => l.status === "issued"); }')
    let = [l for l in p.evaluate('Object.values(window.__db.get("hr/u_m1").letters)') if l['status'] == 'issued'][0]
    check(let['ref'] == 'MM/HR/%s/001' % fy and let['kind'] == 'offer', 'issued letter: %r' % {k: let.get(k) for k in ('ref', 'kind')})
    p.wait_for_selector('#letter-doc')
    body = p.inner_text('#letter-doc')
    check('Durvesh Patil' in body and 'MM/HR/%s/001' % fy in body, 'letter document: ' + body[:200].replace('\n', ' | '))
    # the overview counts the year
    h.go(p, 'founder', hash='#books', width=1280)
    p.wait_for_selector('#books-calls')
    over = p.inner_text('#books-calls') + p.inner_text('#books-aging')
    check('days late' in over and 'SW-001' in over and 'SW-002' in over, 'overview should name the overdue invoice and the draft: ' + over[:300].replace('\n', ' | '))
    # the phone: the invoice document fits
    h.go(p, 'founder', hash='#invoices/' + iid, width=390)
    p.wait_for_selector('#invoice-doc')
    p.wait_for_timeout(400)
    check(h.overflow(p) <= 0, 'phone overflow on the invoice: %d' % h.overflow(p))
    # a member sees none of it
    h.go(p, 'm1', hash='#books', width=1280)
    p.wait_for_timeout(600)
    check(p.locator('.sidebar :text-is("Books")').count() == 0 and p.locator('.tabbar :text-is("Books")').count() == 0, 'a member sees Books in the nav')
    check(h.ctx(p, 'ctx.isOwner') is False and h.ctx(p, '!ctx.coll.invoices || !ctx.coll.invoices.map || Object.keys(ctx.coll.invoices.map).length === 0'), 'a member holds invoice data')
    check(p.locator('#invoice-doc, #books-calls, #inv-list').count() == 0, 'a member landed on the books')
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
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
                           env=dict(os.environ, MOCK_AI='1', BOOKS_RECHECK_MS='0'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
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
            k.add_init_script('window.M360_WELCOME_OFF = true')
            k.goto(base); k.wait_for_selector('#signin-name')
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'books-test-pw-2026')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(600)
            k.evaluate('window.M360_API("mailkey", {key: "re_bookstestkey00000000"})')
            today = k.evaluate('M.U.todayStr()')
            fy = k.evaluate('M.books.fyOf(M.U.todayStr())')
            mid = today[:7]
            k.evaluate('M.lastCtx.W.set("clients/c1", {name: "Swisse Wellness UAE", status: "live", updated: Date.now()})')
            k.evaluate('M.lastCtx.W.set("books/clients", {map: {c1: {code: "TQ", legalName: "Titan Company Ltd", address: "Bengaluru", country: "India", contactEmail: "ap@titan.example", contactName: "Priya Rao", currency: "INR", termsDays: 15, retainer: {active: true, amount: 300000, day: 1, desc: "Monthly retainer", sac: "998361", gst: "intra"}}}, updated: Date.now()})')
            k.wait_for_timeout(400)
            # the next request drafts the retainer on the server and mails the owner
            k.evaluate('window.M360_API("me", {})')
            k.wait_for_timeout(800)
            data = json.loads(urllib.request.urlopen(base + '__store').read())
            doc = json.loads(data.get('d/invoices~' + fy, '{"rows":{}}'))
            drafts = [r for r in doc['rows'].values() if r.get('auto') == 'retainer']
            check(len(drafts) == 1 and drafts[0]['no'] == 'MM/%s/TQ-001' % fy and drafts[0]['autoPeriod'] == mid and drafts[0]['billTo']['contactEmail'] == 'ap@titan.example', 'server retainer draft: %r' % [(d.get('no'), d.get('autoPeriod')) for d in drafts])
            mails = json.loads(urllib.request.urlopen(base + '__mails').read())
            own = [m for m in mails if m['subject'].startswith('Retainer invoice drafted')]
            check(len(own) == 1 and 'kaavish@mask360.agency' in own[0]['to'] and 'TQ-001' in own[0]['text'], 'owner mail: %r' % own)
            # the page, on the books, does not draft it a second time
            k.goto(base + '#invoices'); k.wait_for_selector('#inv-list'); k.wait_for_timeout(15000)
            k.evaluate('window.M360_API("me", {})'); k.wait_for_timeout(500)
            doc = json.loads(json.loads(urllib.request.urlopen(base + '__store').read())['d/invoices~' + fy])
            check(len([r for r in doc['rows'].values() if r.get('auto') == 'retainer']) == 1, 'the retainer was drafted twice')
            iid = [i for i, r in doc['rows'].items() if r.get('auto') == 'retainer'][0]
            # send it through the server: the mail goes out with the cc, the invoice is marked sent
            k.goto(base + '#invoices/' + iid); k.wait_for_selector('#inv-send')
            k.click('#inv-send'); k.wait_for_selector('#send-drawer')
            check(k.input_value('#send-to') == 'ap@titan.example', 'send to: %r' % k.input_value('#send-to'))
            k.click('#send-go')
            k.wait_for_function('() => { const d = M.lastCtx.coll.invoices.map["%s"]; return d && d.rows["%s"] && d.rows["%s"].status === "sent"; }' % (fy, iid, iid))
            mails = json.loads(urllib.request.urlopen(base + '__mails').read())
            sent = [m for m in mails if m['subject'].startswith('Invoice MM/')]
            check(len(sent) == 1 and 'ap@titan.example' in sent[0]['to'] and 'TQ-001' in sent[0]['text'] and '3,54,000' in sent[0]['text'] and 'UTIB0000186' in sent[0]['html'], 'invoice mail: %r' % [(m['to'], m['subject']) for m in sent])
            row = json.loads(json.loads(urllib.request.urlopen(base + '__store').read())['d/invoices~' + fy])['rows'][iid]
            check(row['sentTo'] == 'ap@titan.example' and row['sentAt'], 'the server did not mark the invoice sent: %r' % {k2: row.get(k2) for k2 in ('sentTo', 'sentAt', 'status')})
            # auto-chase: the invoice falls 8 days overdue, the pass sends step 7 once, not twice the same day
            k.evaluate('M.lastCtx.W.merge("books/settings", {chase: {auto: true, days: "3,7,14", cc: "founder@mask360.example"}, updated: Date.now()})')
            k.evaluate('([fy, id, due]) => M.lastCtx.W.merge("invoices/" + fy, {rows: {[id]: {due}}, updated: Date.now()})', [fy, iid, k.evaluate('M.U.ymd(M.U.addDays(M.U.parseYmd(M.U.todayStr()), -8))')])
            k.wait_for_timeout(500)
            k.evaluate('window.M360_API("me", {})'); k.wait_for_timeout(800)
            k.evaluate('window.M360_API("me", {})'); k.wait_for_timeout(800)
            mails = json.loads(urllib.request.urlopen(base + '__mails').read())
            rem = [m for m in mails if m['subject'].startswith('Reminder: invoice')]
            check(len(rem) == 1 and 'ap@titan.example' in rem[0]['to'] and 'days past due' in rem[0]['subject'] and 'UTIB0000186' in rem[0]['text'], 'auto-chase mail: %r' % [(m['to'], m['subject']) for m in rem])
            row = json.loads(json.loads(urllib.request.urlopen(base + '__store').read())['d/invoices~' + fy])['rows'][iid]
            check(len(row.get('chased') or []) == 1 and row['chased'][0]['step'] == 7 and row['chased'][0]['via'] == 'auto', 'chase mark: %r' % row.get('chased'))
            # the books read the owner's Gmail: connect the (canned) Google account, then fill Tanishq's billing from the mail
            k.evaluate('window.M360_API("googlekey", {clientId: "%s", clientKey: "GOCSPX-test-secret"})' % GOOGLE_CLIENT)
            r = k.evaluate('window.M360_API("googlestart", {back: "#billing"})')
            state = r['url'].split('state=')[1].split('&')[0]
            k.goto(base + 'api/google?code=fake-code-ok&state=' + state)
            k.wait_for_selector('.sidebar')
            k.goto(base + '#billing/c1'); k.wait_for_selector('#billing-read')
            k.click('#billing-read')
            k.wait_for_selector('#billing-found', timeout=30000)
            found = k.inner_text('#billing-found')
            check('Swisse Wellness Middle East FZ LLC' in found and '100234567800003' in found and 'ap@swisse.example' in found and 'Omar Haddad' in found and 'PO-4471.pdf' in found, 'found from the mail: ' + found.replace(chr(10), ' | ')[:300])
            k.click('#billing-use-all')
            k.wait_for_timeout(200)
            check(k.input_value('#billing-legal') == 'Swisse Wellness Middle East FZ LLC' and k.input_value('#billing-taxid') == '100234567800003' and k.input_value('#billing-terms') == '30' and k.input_value('#billing-po') == '4471', 'use all: %r' % [k.input_value(x) for x in ('#billing-legal', '#billing-taxid', '#billing-terms', '#billing-po')])
            k.click('#billing-save')
            k.wait_for_function('() => { const m = (M.lastCtx.coll.books.map.clients || {}).map || {}; return m.c1 && m.c1.taxId === "100234567800003"; }')
            # the scan across every client fills only what is blank
            k.evaluate('M.lastCtx.W.set("clients/c2", {name: "Marina", status: "live", updated: Date.now()})')
            k.goto(base + '#billing'); k.wait_for_selector('#billing-scan')
            k.click('#billing-scan')
            k.wait_for_function('() => document.querySelector("#billing-scan") && !/Reading/.test(document.querySelector("#billing-scan").textContent)', timeout=60000)
            logt = k.inner_text('#billing-scan-log')
            check('Marina: legal name' in logt and 'nothing new' in logt, 'scan log: ' + logt.replace(chr(10), ' | '))
            m2 = k.evaluate('(M.lastCtx.coll.books.map.clients || {}).map.c2')
            check(m2 and m2.get('legalName') == 'Swisse Wellness Middle East FZ LLC' and m2.get('country') == 'United Arab Emirates' and m2.get('currency') == 'AED', 'the scan should draft the new client from the mail: %r' % m2)
            # nobody but the owner sends an invoice mail: a call without the owner's cookie is refused
            req = urllib.request.Request(base + 'api/m360', data=json.dumps({'a': 'invoicesend', 'fy': fy, 'id': iid, 'to': 'x@y.example', 'subject': 's', 'text': 't'}).encode(), headers={'content-type': 'application/json'}, method='POST')
            try:
                urllib.request.urlopen(req); status = 200
            except urllib.error.HTTPError as e:
                status = e.code
            check(status in (401, 403), 'a signed-out call to invoicesend answered %r' % status)
            before = len(json.loads(urllib.request.urlopen(base + '__mails').read()))
            check(before == len(mails), 'a refused call still sent mail')
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
