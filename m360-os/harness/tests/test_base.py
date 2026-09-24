#!/usr/bin/env python3
"""v6 base test: the founder imports an Apollo CSV (BOM, CRLF, a quoted comma and newline, a row
with no name and no email, a duplicate row), the mapping table keeps only the useful columns, the
summary counts match, the pages hold the right fields, the matching company maps to the seeded
client both ways; a member searches, opens a person, edits a title and the edit survives a second
import; the company drawer lists the shared company's people and Make this a client flips them to
stage client; the phone layout holds at 390 with the drawer open.

Run: cd m360-os && python3 harness/tests/test_base.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run, ROOT  # noqa: E402
from harness.qa import seed  # noqa: E402

FIXTURE = os.path.join(ROOT, 'harness', 'fixtures', 'apollo-sample.csv')
IGNORED = ('emailSent', 'emailOpen', 'technologies', 'annualRevenue', 'twitterUrl', 'facebookUrl', 'emailStatus',
           'emailConfidence', 'primaryIntentTopic', 'numberOfRetailLocations', 'seoDescription', 'companyAddress')


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def doc(p, path):
        return p.evaluate('window.__db.get("%s")' % path)

    def rows(p, path):
        d = doc(p, path) or {}
        return d.get('rows') or {}

    def by_name(p, coll, name):
        for pid in ('p000', 'p001'):
            for rid, r in rows(p, coll + '/' + pid).items():
                if r.get('name') == name:
                    return rid, r
        return None, None

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)

    # ---- founder: import the fixture ----
    h.go(p, 'founder', hash='#import', width=1280)
    p.wait_for_selector('#import-file')
    check('the database' in p.inner_text('.hero') and 'Base' in p.inner_text('.hero'), 'hero missing')
    p.set_input_files('#import-file', FIXTURE)
    p.wait_for_selector('#import-map')
    body = p.inner_text('#import-mapcard')
    check('12 rows' in body and '62 columns' in body, 'counts line: ' + body[:200])
    check('1 skipped' in body and '1 duplicate row' in body, 'skip and duplicate counts: ' + body[:300])
    first = p.locator('#import-map tr[data-col="First Name"] select').input_value()
    check(first == 'first', 'First Name maps to %r' % first)
    check(p.locator('#import-map tr[data-col="Company"] select').input_value() == 'orgName', 'Company mapping')
    check(p.locator('#import-map tr[data-col="Apollo Contact Id"] select').input_value() == 'apolloId', 'Apollo Contact Id mapping')
    check(p.locator('#import-map tr[data-col="Email Sent"] select').input_value() == '', 'Email Sent should be ignored')
    check(p.locator('#import-map tr.bs-ignored').count() >= 25, 'too few ignored columns: %d' % p.locator('#import-map tr.bs-ignored').count())
    check(p.locator('#import-preview .bs-prev').count() == 5, 'preview rows')
    go = p.locator('#import-go')
    check(go.inner_text().strip().endswith('Import 10 people'), 'go button: ' + go.inner_text())
    go.click()
    p.wait_for_selector('#import-summary')
    summ = p.inner_text('#import-summary')
    vals = p.evaluate('() => Array.from(document.querySelectorAll("#import-summary .kpi")).map(k => [k.querySelector(".l").textContent, k.querySelector(".v").textContent])')
    kp = {l: int(v) for l, v in vals}
    check(kp == {'new people': 10, 'updated': 0, 'unchanged': 0, 'new companies': 5, 'mapped to clients': 1, 'skipped': 1}, 'summary %r' % kp)
    check('row 12 (no name and no email)' in summ, 'skipped reason: ' + summ)
    check('1 duplicate row in the file folded into one person' in summ, 'duplicate line: ' + summ)

    # ---- the pages ----
    cp = doc(p, 'contacts/p000')
    check(cp and cp.get('n') == 10 and len(cp['rows']) == 10, 'contacts/p000 holds %r rows' % (cp and len(cp.get('rows', {}))))
    check(doc(p, 'contacts/p001') is None, 'a second contacts page appeared')
    op = doc(p, 'orgs/p000')
    check(op and op.get('n') == 5 and len(op['rows']) == 5, 'orgs/p000 holds %r' % (op and len(op.get('rows', {}))))
    oid, omar = by_name(p, 'contacts', 'Omar Haddad')
    check(omar is not None, 'Omar missing')
    if omar:
        check(omar['title'] == 'Head of Brand, Marketing and Communications', 'quoted title: %r' % omar['title'])
        check(omar['email'] == 'omar.haddad@swissewellness.ae' and omar['phone'] == '+971 4 555 0101', 'email or phone: %r %r' % (omar['email'], omar['phone']))
        check(omar['mobile'] == '+971 50 555 0101', 'duplicate row did not fill the mobile: %r' % omar['mobile'])
        check(sorted(omar['tags']) == ['Q3 outreach', 'UAE wellness'], 'tags union: %r' % omar['tags'])
        check(omar['stage'] == 'replied' and omar['source'] == 'apollo' and omar['apolloId'] == 'ct_0001', 'stage, source, apolloId: %r' % {k: omar[k] for k in ('stage', 'source', 'apolloId')})
        check(omar['first'] == 'Omar' and omar['last'] == 'Haddad' and omar['city'] == 'Dubai' and omar['country'] == 'United Arab Emirates', 'name and place fields')
        check(omar['seniority'] == 'Head' and omar['dept'] == 'Marketing' and omar['linkedin'].startswith('http://www.linkedin.com/in/omar'), 'seniority, dept, linkedin')
        check(omar['owner'] == 'u_founder', 'Contact Owner resolved to %r' % omar['owner'])
        check(oid.startswith('c_') and len(oid) == 12 and omar['id'] == oid, 'contact id shape %r' % oid)
        check(omar['org'].startswith('o_') and omar['orgName'] == 'Swisse Wellness UAE', 'org link: %r %r' % (omar['org'], omar['orgName']))
        leaked = [k for k in omar if k in IGNORED or k.lower() in ('technologies', 'replied', 'demoed', 'emailbounced')]
        check(not leaked, 'ignored Apollo fields leaked: %r' % leaked)
    _, tara = by_name(p, 'contacts', 'Tara Deshpande')
    check(tara and tara['email2'] == 'tara.deshpande@gmail.com' and tara['stage'] == 'replied', 'second email or stage on Tara')
    _, vikram = by_name(p, 'contacts', 'Vikram Sethi')
    check(vikram and vikram['stage'] == 'lost', 'Not Interested should map to lost: %r' % (vikram and vikram['stage']))
    _, ravi = by_name(p, 'contacts', 'Ravi Menon')
    check(ravi and ravi['stage'] == 'meeting', 'Meeting Booked should map to meeting')
    sw_id, sw = by_name(p, 'orgs', 'Swisse Wellness UAE')
    check(sw is not None, 'Swisse org missing')
    if sw:
        check(sw['domain'] == 'swissewellness.ae' and sw['website'] == 'https://www.swissewellness.ae', 'domain or website: %r %r' % (sw['domain'], sw['website']))
        check(sw['industry'] == 'Health, Wellness & Fitness' and sw['size'] == '180' and sw['city'] == 'Dubai' and sw['country'] == 'United Arab Emirates', 'org fields')
        check(sw['keywords'] == ['vitamins', 'wellness', 'supplements', 'beauty from within'], 'keywords: %r' % sw['keywords'])
        check(sw['apolloId'] == 'acc_sw01' and sw['source'] == 'apollo' and sw['phone'] == '+971 4 555 0100', 'org apollo id, source, phone')
        check(sw['client'] == 'swisse-wellness-uae', 'org not mapped to the seeded client: %r' % sw['client'])
        check(sw_id.startswith('o_') and len(sw_id) == 12, 'org id shape')
        check('annualRevenue' not in sw and 'technologies' not in sw and 'address' not in sw, 'ignored company fields leaked')
    p.wait_for_function('() => (window.__db.get("clients/swisse-wellness-uae") || {}).org === "%s"' % sw_id)
    check(doc(p, 'settings/app').get('base', {}).get('lastImport', {}).get('added') == 10, 'settings lastImport')
    hero = p.inner_text('.hero')
    check('10' in hero and 'people' in hero and '5' in hero and 'mapped to clients' in hero, 'hero chips: ' + hero)
    h.shot(p, 'base-import')

    # ---- a member searches, opens and edits ----
    h.go(p, 'm1', hash='#base', width=1280)
    p.wait_for_selector('#base-q')
    check(p.locator('.bs-row').count() == 10, 'people rows: %d' % p.locator('.bs-row').count())
    p.fill('#base-q', 'swisse')
    p.wait_for_function('() => document.querySelectorAll(".bs-row").length === 2')
    check('Swisse Wellness UAE' in p.inner_text('#base-orgs'), 'company strip missing')
    p.fill('#base-q', 'Omar')
    p.wait_for_function('() => document.querySelectorAll(".bs-row").length === 1')
    check('Omar Haddad' in p.inner_text('.bs-row') and 'at Swisse Wellness UAE' in p.inner_text('.bs-row'), 'row text: ' + p.inner_text('.bs-row'))
    p.locator('.bs-row .bs-main').click()
    p.wait_for_selector('#contact-drawer')
    check(p.input_value('#contact-title') == 'Head of Brand, Marketing and Communications', 'drawer title prefill')
    check('updated' in p.inner_text('#contact-drawer') and 'Kaavish Ramchandani' in p.inner_text('#contact-drawer'), 'stamp line missing')
    where = p.inner_text('#contact-drawer')
    check('Swisse Wellness UAE' in where and 'Swisse 30 reels' in where, 'where they appear: ' + where[-400:])
    check(p.locator('#contact-intro').count() == 1, 'AI intro block missing')
    p.fill('#contact-title', 'VP Brand')
    p.click('#contact-save')
    p.wait_for_function('() => Object.values(window.__db.get("contacts/p000").rows).some(r => r.title === "VP Brand")')
    omar = rows(p, 'contacts/p000')[oid]
    check(omar['edited'] == {'title': True} and omar['updatedBy'] == 'u_m1', 'edit marks: %r %r' % (omar.get('edited'), omar.get('updatedBy')))
    check(omar['stage'] == 'replied' and omar['phone'] == '+971 4 555 0101', 'save touched other fields')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    check(p.evaluate('location.hash') == '#base', 'hash after close: ' + p.evaluate('location.hash'))
    h.go(p, 'm1', hash='#base/' + oid, width=1280)
    p.wait_for_selector('#contact-drawer')
    check(p.input_value('#contact-title') == 'VP Brand', 'deep link did not open the contact')
    p.keyboard.press('Escape')
    p.wait_for_function('() => location.hash === "#base"')
    # members do not import
    h.go(p, 'm1', hash='#import', width=1280)
    p.wait_for_selector('#base-import, .card:has-text("Imports are done by Kaavish")')
    check('Imports are done by Kaavish' in p.inner_text('.content') and p.locator('#import-file').count() == 0, 'member sees the import form')

    # ---- founder: the same CSV again, the hand edit survives ----
    h.go(p, 'founder', hash='#import', width=1280)
    p.set_input_files('#import-file', FIXTURE)
    p.wait_for_selector('#import-map')
    body = p.inner_text('#import-mapcard')
    check('0 new, 0 updated, 10 unchanged' in body, 'second plan: ' + body[:300])
    p.click('#import-go')
    p.wait_for_selector('#import-summary')
    vals = p.evaluate('() => Array.from(document.querySelectorAll("#import-summary .kpi")).map(k => [k.querySelector(".l").textContent, k.querySelector(".v").textContent])')
    kp = {l: int(v) for l, v in vals}
    check(kp['new people'] == 0 and kp['updated'] == 0 and kp['unchanged'] == 10 and kp['new companies'] == 0, 'second summary %r' % kp)
    omar = rows(p, 'contacts/p000')[oid]
    check(omar['title'] == 'VP Brand' and omar['edited'] == {'title': True}, 'edited title lost: %r' % omar['title'])
    check(len(rows(p, 'contacts/p000')) == 10 and len(rows(p, 'orgs/p000')) == 5, 'second import added rows')

    # ---- companies: the shared company, make one a client ----
    h.go(p, 'founder', hash='#companies', width=1280)
    p.wait_for_selector('#companies-q')
    check(p.locator('.bs-card').count() == 5, 'company cards: %d' % p.locator('.bs-card').count())
    sw_card = p.locator('.bs-card[data-org="%s"]' % sw_id)
    check('2 people' in sw_card.inner_text() and 'Swisse Wellness UAE' in sw_card.inner_text(), 'Swisse card: ' + sw_card.inner_text())
    p.get_by_role('button', name='Mapped to a client').click()
    p.wait_for_function('() => document.querySelectorAll(".bs-card").length === 1')
    p.get_by_role('button', name='Mapped to a client').click()
    sw_card.click()
    p.wait_for_selector('#org-drawer')
    check(p.locator('#org-people .bs-person').count() == 2, 'Swisse people in the drawer: %d' % p.locator('#org-people .bs-person').count())
    check('Unmap' in p.inner_text('#org-mapping') and 'Swisse Wellness UAE' in p.inner_text('#org-mapping'), 'mapping box: ' + p.inner_text('#org-mapping'))
    p.locator('#org-people .bs-person').first.click()
    p.wait_for_function('() => location.hash.indexOf("#base/c_") === 0')
    p.wait_for_selector('#contact-drawer')
    p.keyboard.press('Escape')
    h.go(p, 'founder', hash='#companies', width=1280)
    au_id, au = by_name(p, 'orgs', 'Aurelia Jewels')
    p.locator('.bs-card[data-org="%s"]' % au_id).click()
    p.wait_for_selector('#org-make-client')
    p.click('#org-make-client')
    p.wait_for_function('() => Object.values(window.__db.store()).some(d => d && d.name === "Aurelia Jewels" && d.org === "%s")' % au_id)
    p.wait_for_function('() => window.__db.get("orgs/p000").rows["%s"].client' % au_id)
    cid = rows(p, 'orgs/p000')[au_id]['client']
    cl = doc(p, 'clients/' + cid)
    check(cl and cl['status'] == 'live' and cl['owner'] == 'u_founder' and cl['org'] == au_id and cl['memory'] == '', 'client doc %r' % cl)
    p.wait_for_function('() => Object.values(window.__db.get("contacts/p000").rows).filter(r => r.org === "%s").every(r => r.stage === "client")' % au_id)
    check('Unmap' in p.inner_text('#org-mapping'), 'drawer did not switch to mapped')
    p.keyboard.press('Escape')
    h.go(p, 'founder', hash='#clients', width=1280)
    p.wait_for_selector('.card.rowbtn:has-text("Aurelia Jewels")')
    # unmap, then map again by the select
    h.go(p, 'founder', hash='#companies/' + au_id, width=1280)
    p.wait_for_selector('#org-mapping')
    p.locator('#org-mapping').get_by_role('button', name='Unmap').click()
    p.locator('#org-mapping').get_by_role('button', name='Tap again to unmap').click()
    p.wait_for_function('() => !window.__db.get("orgs/p000").rows["%s"].client' % au_id)
    check(doc(p, 'clients/' + cid)['org'] == '', 'client kept its org after unmap')
    p.select_option('#org-client', cid)
    p.click('#org-map')
    p.wait_for_function('() => window.__db.get("orgs/p000").rows["%s"].client === "%s"' % (au_id, cid))
    p.wait_for_function('() => window.__db.get("clients/%s").org === "%s"' % (cid, au_id))
    p.keyboard.press('Escape')

    # ---- a client created from Accounts maps itself on the next Base render ----
    h.seed_doc(p, 'clients/marina-hotels', {'name': 'Marina Hotels Pvt Ltd', 'status': 'pitch', 'pod': '', 'owner': 'u_founder',
                                            'memory': '', 'approvals': '', 'never': '', 'links': '', 'updated': 1, 'by': 'u_founder'})
    h.go(p, 'founder', hash='#base', width=1280)
    ma_id, _ = by_name(p, 'orgs', 'Marina Hotels')
    p.wait_for_function('() => (window.__db.get("clients/marina-hotels") || {}).org === "%s"' % ma_id)
    p.wait_for_function('() => window.__db.get("orgs/p000").rows["%s"].client === "marina-hotels"' % ma_id)

    # ---- add a person by hand, export ----
    p.click('#base-add')
    p.wait_for_selector('#contact-drawer')
    p.fill('#contact-first', 'Priya')
    p.fill('#contact-last', 'Shah')
    p.fill('#contact-orgname', 'Lumen Studio')
    p.get_by_role('button', name='New company from this name').click()
    p.wait_for_function('() => Object.values(window.__db.get("orgs/p000").rows).some(r => r.name === "Lumen Studio")')
    p.fill('#contact-tags', 'design, mumbai')
    p.click('#contact-save')
    p.wait_for_function('() => Object.values(window.__db.get("contacts/p000").rows).some(r => r.name === "Priya Shah")')
    _, priya = by_name(p, 'contacts', 'Priya Shah')
    check(priya['source'] == 'manual' and priya['tags'] == ['design', 'mumbai'] and priya['org'].startswith('o_') and priya['orgName'] == 'Lumen Studio', 'manual person %r' % {k: priya[k] for k in ('source', 'tags', 'org', 'orgName')})
    check(doc(p, 'contacts/p000')['n'] == 11 and doc(p, 'orgs/p000')['n'] == 6, 'page counts after manual adds')
    p.wait_for_function('() => !document.querySelector(".drawer")')
    p.click('#base-export')
    p.wait_for_function('() => window.__downloads.length === 1')
    dl = p.evaluate('window.__downloads[0]')
    check(dl['filename'].startswith('base-people-') and dl['data'].count('\n') == 11 and '"Omar Haddad"' in dl['data'] and 'technologies' not in dl['data'].lower(), 'export csv: ' + dl['filename'])
    # search ranking: exact name start first
    p.fill('#base-q', 'ar')
    p.wait_for_function('() => document.querySelectorAll(".bs-row").length >= 2')
    names = p.evaluate('() => Array.from(document.querySelectorAll(".bs-row .bs-name")).map(e => e.textContent)')
    check(names[0] == 'Arjun Bhatia', 'ranking: %r' % names[:3])
    # helpers
    found = h.ctx(p, 'M.base.find(ctx, "swisse").contacts.map(c => c.name).concat(M.base.find(ctx, "swisse").orgs.map(o => o.name))')
    check(sorted(found) == ['Layla Nasser', 'Omar Haddad', 'Swisse Wellness UAE'], 'find helper %r' % found)
    check(h.ctx(p, 'M.base.orgForClient(ctx, "swisse-wellness-uae").id') == sw_id, 'orgForClient')
    check(h.ctx(p, 'M.base.peopleAt(ctx, "%s").length' % sw_id) == 2, 'peopleAt')
    check(h.ctx(p, 'M.base.pageFor(ctx, "contacts", "%s")' % oid) == 'p000', 'pageFor')
    check(h.ctx(p, 'M.base.norm.name("Aurelia Jewels Pvt. Ltd.")') == 'aurelia jewels', 'norm.name')
    check(h.ctx(p, 'M.base.norm.domain("https://www.Example.co.in/about?x=1")') == 'example.co.in', 'norm.domain')
    parsed = h.ctx(p, 'M.base.parseCsv("\\ufeffa,b\\r\\n1,\\"x,\\"\\"y\\"\\"\\nz\\"\\r\\n")')
    check(parsed == {'headers': ['a', 'b'], 'rows': [['1', 'x,"y"\nz']]}, 'parseCsv %r' % parsed)
    check(h.ctx(p, 'M.base.mapApollo(["First Name", "Email Sent", "Website"]).map(m => m.field)') == ['first', '', 'orgWebsite'], 'mapApollo')

    # ---- phone ----
    h.go(p, 'm2', hash='#base', width=390)
    p.wait_for_selector('#base-q')
    check(h.overflow(p) <= 0, 'phone overflow %d' % h.overflow(p))
    h.go(p, 'm2', hash='#base/' + oid, width=390)
    p.wait_for_selector('#contact-drawer')
    check(h.overflow(p) <= 0, 'phone overflow with the drawer %d' % h.overflow(p))
    box = p.locator('.drawer').bounding_box()
    check(box['x'] >= 0 and box['x'] + box['width'] <= 390, 'drawer off screen')
    check(not h.small_text(p), 'small text: %r' % h.small_text(p)[:2])
    h.shot(p, 'base-390-drawer')
    p.keyboard.press('Escape')
    h.go(p, 'm2', hash='#companies', width=390)
    p.wait_for_selector('.bs-card')
    check(h.overflow(p) <= 0, 'companies phone overflow %d' % h.overflow(p))
    h.go(p, 'founder', hash='#import', width=390)
    p.set_input_files('#import-file', FIXTURE)
    p.wait_for_selector('#import-map')
    check(h.overflow(p) <= 0, 'import phone overflow %d' % h.overflow(p))
    h.shot(p, 'base-390-import')

    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
