#!/usr/bin/env python3
"""v6 search: the master search under Cmd K finds people and companies from the Base under the right
headings and opens them; "Show all" opens the Search drawer with grouped results and filters; the
client page, pitch drawer and project page show Connections; the pitch drawer picks a Base contact;
Ask m360 answers "who do we know at" through the tool; quiet leads and nudges; a member never sees
another member's leave through search; the drawer fits 390 wide; no console errors.

Run: cd m360-os && python3 harness/tests/test_search.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402

F, M1, M2 = 'u_founder', 'u_m1', 'u_m2'
CLIENT = 'swisse-wellness-uae'
DAY = 86400000


def base_seed(h, page):
    """Six contacts at three companies; one company is the seeded client."""
    now = int(time.time() * 1000)
    orgs = {
        'o1': {'id': 'o1', 'name': 'Tata Motors', 'domain': 'tatamotors.com', 'website': 'https://www.tatamotors.com', 'industry': 'Automotive',
               'size': '10000+', 'city': 'Mumbai', 'state': 'Maharashtra', 'country': 'India', 'linkedin': '', 'phone': '', 'keywords': ['auto', 'ev'],
               'source': 'apollo', 'apolloId': 'a1', 'client': '', 'tags': [], 'notes': '', 'edited': {}, 'at': now - 60 * DAY, 'updated': now - 60 * DAY, 'updatedBy': F, 'archived': False},
        'o2': {'id': 'o2', 'name': 'Swisse Wellness UAE', 'domain': 'swisse.ae', 'website': 'https://swisse.ae', 'industry': 'Wellness',
               'size': '200', 'city': 'Dubai', 'state': '', 'country': 'UAE', 'linkedin': '', 'phone': '', 'keywords': ['wellness'],
               'source': 'apollo', 'apolloId': 'a2', 'client': CLIENT, 'tags': [], 'notes': '', 'edited': {}, 'at': now - 30 * DAY, 'updated': now - 30 * DAY, 'updatedBy': F, 'archived': False},
        'o3': {'id': 'o3', 'name': 'Marina Hotels', 'domain': 'marinahotels.ae', 'website': '', 'industry': 'Hospitality',
               'size': '500', 'city': 'Dubai', 'state': '', 'country': 'UAE', 'linkedin': '', 'phone': '', 'keywords': [],
               'source': 'manual', 'apolloId': '', 'client': '', 'tags': [], 'notes': '', 'edited': {}, 'at': now - 10 * DAY, 'updated': now - 10 * DAY, 'updatedBy': F, 'archived': False},
    }
    people = [
        ('c1', 'Priya', 'Iyer', 'Marketing head', 'o1', 'Mumbai', 'contacted', now - 40 * DAY),
        ('c2', 'Arjun', 'Sethi', 'Brand manager', 'o1', 'Mumbai', 'replied', now - 2 * DAY),
        ('c3', 'Omar', 'Haddad', 'Brand director', 'o2', 'Dubai', 'client', now - 5 * DAY),
        ('c4', 'Leila', 'Nasser', 'Content lead', 'o2', 'Dubai', 'meeting', now - 2 * DAY),
        ('c5', 'Ravi', 'Menon', 'Head of marketing', 'o3', 'Dubai', 'lead', now - 3 * DAY),
        ('c6', 'Zara', 'Khan', 'Digital manager', 'o3', 'Dubai', 'lost', now - 50 * DAY),
    ]
    rows = {}
    for cid, first, last, title, org, city, stage, upd in people:
        rows[cid] = {'id': cid, 'first': first, 'last': last, 'name': first + ' ' + last, 'title': title,
                     'email': (first + '.' + last + '@' + orgs[org]['domain']).lower(), 'email2': '', 'phone': '', 'mobile': '', 'linkedin': '',
                     'org': org, 'orgName': orgs[org]['name'], 'city': city, 'state': '', 'country': orgs[org]['country'],
                     'seniority': 'manager', 'dept': 'marketing', 'source': 'apollo', 'apolloId': 'p' + cid, 'tags': [],
                     'stage': stage, 'owner': F, 'notes': '', 'edited': {}, 'at': upd - DAY, 'updated': upd, 'updatedBy': F, 'archived': False}
    h.seed_doc(page, 'contacts/p000', {'rows': rows, 'n': len(rows)})
    h.seed_doc(page, 'orgs/p000', {'rows': orgs, 'n': len(orgs)})
    client = page.evaluate('() => window.__db.get("clients/%s")' % CLIENT)
    client['org'] = 'o2'
    h.seed_doc(page, 'clients/' + CLIENT, client)
    page.wait_for_timeout(300)


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
            print('FAIL:', msg)

    def doc(p, path):
        return p.evaluate('window.__db.get("%s")' % path)

    def open_palette(p, text):
        p.keyboard.press('Control+k')
        p.wait_for_selector('#pal-input')
        p.fill('#pal-input', text)
        p.wait_for_timeout(250)

    def groups(p):
        return p.evaluate('() => Array.from(document.querySelectorAll("#pal-list .pal-group")).map(e => e.textContent)')

    def item_group(p, text):
        return p.evaluate('t => { const el = Array.from(document.querySelectorAll("#pal-list .pal-item")).find(e => (e.querySelector(".t") || e).textContent.includes(t)); return el ? el.getAttribute("data-group") : null; }', text)

    def selected(p):
        return p.evaluate('() => Array.from(document.querySelectorAll("#pal-list .pal-item")).findIndex(e => e.classList.contains("on"))')

    p = h.session('founder', width=1280, hash='#home', reset=True, seed=True)
    seed(h, p)
    base_seed(h, p)
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.side-tools')

    # ---- palette: a contact by first name, under people, Enter opens #base/<cid> ----
    open_palette(p, 'priya')
    p.wait_for_selector('.pal-item:has-text("Priya Iyer")')
    check(item_group(p, 'Priya Iyer') == 'people', 'contact is not under people: %r' % item_group(p, 'Priya Iyer'))
    check('Marketing head' in p.inner_text('#pal-list') and 'Tata Motors' in p.inner_text('#pal-list'), 'contact row lacks title and company')
    first = p.locator('#pal-list .pal-item').first.inner_text()
    check('Priya Iyer' in first, 'exact prefix match is not first: %r' % first)
    p.keyboard.press('Enter')
    p.wait_for_function('() => location.hash === "#base/c1"')
    check(p.evaluate('location.hash') == '#base/c1', 'Enter did not open the contact: ' + p.evaluate('location.hash'))

    # ---- palette: a company name lists the company and its people under the right headings ----
    h.go(p, 'founder', hash='#home', width=1280)
    open_palette(p, 'tata')
    p.wait_for_selector('.pal-item:has-text("Tata Motors")')
    g = groups(p)
    check('people' in g and 'companies' in g, 'headings missing: %r' % g)
    check(g.index('people') < g.index('companies'), 'people should come before companies: %r' % g)
    check(item_group(p, 'Tata Motors') == 'companies', 'company is not under companies')
    check(item_group(p, 'Arjun Sethi') == 'people' and item_group(p, 'Priya Iyer') == 'people', 'people at Tata missing from people')
    check(p.locator('#pal-list .pal-item.ai').count() == 1, 'Ask m360 line missing')
    check('Ask m360' in p.locator('#pal-list .pal-item').last.inner_text(), 'Ask m360 is not the last row')
    p.locator('.pal-item[data-group="companies"]', has_text='Tata Motors').click()
    p.wait_for_function('() => location.hash === "#companies/o1"')

    # ---- keyboard: arrows move the selection, Escape closes ----
    h.go(p, 'founder', hash='#home', width=1280)
    open_palette(p, 'swisse')
    p.wait_for_selector('.pal-item.on')
    before = selected(p)
    p.keyboard.press('ArrowDown')
    p.wait_for_timeout(80)
    check(selected(p) == before + 1, 'ArrowDown did not move the selection: %d to %d' % (before, selected(p)))
    p.keyboard.press('ArrowUp')
    p.wait_for_timeout(80)
    check(selected(p) == before, 'ArrowUp did not move back')
    p.keyboard.press('Escape')
    p.wait_for_function('() => !document.querySelector(".pal")')

    # ---- Show all opens the Search drawer with grouped results and filter chips ----
    open_palette(p, 'swisse')
    p.wait_for_selector('.pal-item.more')
    p.locator('.pal-item.more', has_text='Show all').click()
    p.wait_for_selector('#search-all')
    body = p.inner_text('#search-all')
    for want in ('Swisse Wellness UAE', 'Omar Haddad', 'Leila Nasser', 'Swisse 30 reels'):
        check(want in body, 'search drawer missing %r' % want)
    chips = p.locator('#search-all .srch-chips .chip')
    check(chips.count() >= 3, 'filter chips missing: %d' % chips.count())
    micro = p.evaluate('() => Array.from(document.querySelectorAll("#search-all .srch-list .micro")).map(e => e.textContent)')
    check('People' in micro and 'Companies' in micro and 'Projects' in micro and 'Clients' in micro, 'drawer groups: %r' % micro)
    chips.filter(has_text='People').click()
    p.wait_for_timeout(150)
    micro = p.evaluate('() => Array.from(document.querySelectorAll("#search-all .srch-list .micro")).map(e => e.textContent)')
    check(micro == ['People'], 'people filter left other groups: %r' % micro)
    check(p.locator('#search-all #ask-base').count() == 1, 'Ask the base is missing from the drawer')
    p.locator('#search-all .conn-row', has_text='Omar Haddad').click()
    p.wait_for_function('() => location.hash === "#base/c3"')
    check(p.locator('#search-all').count() == 0, 'search drawer stayed open after navigating')

    # ---- the client page: Connections with the company, its people and the projects ----
    h.go(p, 'founder', hash='#clients', width=1280)
    p.locator('.card.rowbtn', has_text='Swisse Wellness UAE').click()
    p.wait_for_selector('#connections')
    conn = p.inner_text('#connections')
    for want in ('Swisse Wellness UAE', 'Omar Haddad', 'Leila Nasser', 'Swisse 30 reels'):
        check(want in conn, 'client Connections missing %r' % want)
    check(p.locator('#connections .conn-row[data-conn="oo2"]').count() == 1, 'client Connections lacks the org row')
    check(p.input_value('#client-org') == 'o2', 'client drawer does not show the linked company')
    p.locator('#connections .conn-row', has_text='Swisse 30 reels').click()
    p.wait_for_function('() => location.hash === "#projects/p1"')
    p.wait_for_selector('#connections')
    conn = p.inner_text('#connections')
    check('Swisse Wellness UAE' in conn and 'Omar Haddad' in conn, 'project Connections missing the client and its people: %r' % conn[:200])
    # #clients/<id> opens the drawer straight away
    h.go(p, 'founder', hash='#clients/' + CLIENT, width=1280)
    p.wait_for_selector('.drawer #client-name')
    check(p.input_value('#client-name') == 'Swisse Wellness UAE', 'deep link did not open the client')
    p.keyboard.press('Escape')
    p.wait_for_function('() => location.hash === "#clients"')

    # ---- the pitch drawer: a contact Select from the Base, saved as pitch.contact ----
    h.go(p, 'founder', hash='#pitches/pi1', width=1280)
    p.wait_for_selector('.drawer #pitch-brand')
    check(p.input_value('#pitch-brand') == 'Aurelia Jewels', 'deep link did not open the pitch')
    check(p.locator('#pitch-contact').count() == 1, 'typed contact field missing while nothing is picked')
    p.select_option('#pitch-contact-pick', 'c5')
    p.wait_for_timeout(100)
    check(p.locator('#pitch-contact').count() == 0, 'typed contact field still shows after picking a contact')
    p.get_by_role('button', name='Save').click()
    p.wait_for_function('() => window.__db.get("pitches/pi1").contact === "c5"')
    check(doc(p, 'pitches/pi1')['contact'] == 'c5', 'pitch.contact not saved')
    h.go(p, 'founder', hash='#pitches/pi1', width=1280)
    p.wait_for_selector('.drawer #pitch-contact-pick')
    check(p.input_value('#pitch-contact-pick') == 'c5', 'contact pick not read back')
    p.wait_for_selector('#connections')
    conn = p.inner_text('#connections')
    check('Ravi Menon' in conn and 'Marina Hotels' in conn, 'pitch Connections missing the contact and company: %r' % conn[:200])
    # the seeded Marina Hotels pitch is a won pitch on a brand with a company in the Base
    p.keyboard.press('Escape')
    h.go(p, 'founder', hash='#companies/o3', width=1280)
    conn = h.ctx(p, 'M.search.connectionsOf(ctx, "org", "o3").map(r => r.group + ":" + r.label).join("|")')
    check('people:Ravi Menon' in conn and 'pitches:Marina Hotels' in conn, 'org connections: %r' % conn)

    # ---- Ask m360: who do we know at Tata Motors, through the tool ----
    h.go(p, 'founder', hash='#home', width=1280)
    p.wait_for_selector('.side-tools')
    p.evaluate('window.__sampleCalls = []')
    p.locator('.side-tools').get_by_role('button', name='Ask m360').click()
    p.fill('#ask-input', 'who do we know at Tata Motors')
    p.keyboard.press('Enter')
    p.wait_for_selector('.bubble.ai:has-text("Priya Iyer")', timeout=10000)
    ans = p.inner_text('.drawer')
    check('Priya Iyer' in ans and 'Arjun Sethi' in ans, 'Ask did not answer with the seeded names: %r' % ans[-300:])
    calls = p.evaluate('window.__sampleCalls')
    askp = [c for c in calls if c.get('tools')]
    check(askp and 'who_do_we_know_at' in askp[-1]['tools'] and 'search_base' in askp[-1]['tools'] and 'pipeline_for' in askp[-1]['tools'], 'base tools not offered: %r' % (askp[-1]['tools'] if askp else None))
    check('The Base is the agency contacts database' in (askp[-1]['text'] if askp else ''), 'system prompt lacks the Base line')
    p.keyboard.press('Escape')
    # the tools never hand the model a full address
    out = h.ctx(p, 'M.intel.tools(ctx, {}).find(t => t.name === "search_base").execute({q: "priya"})')
    check(out['people'] and out['people'][0]['name'] == 'Priya Iyer' and out['people'][0]['domain'] == 'tatamotors.com', 'search_base result: %r' % out)
    check('@' not in str(out), 'a full address leaked to the model: %r' % out)
    pipe = h.ctx(p, 'M.intel.tools(ctx, {}).find(t => t.name === "pipeline_for").execute({q: "", company: "Swisse"})')
    check(any(x['name'] == 'Swisse 30 reels' for x in pipe['projects']), 'pipeline_for missing the project: %r' % pipe)
    every = h.ctx(p, 'M.intel.tools(ctx, {}).find(t => t.name === "search_everything").execute({q: "swisse"})')
    kinds = {x['kind'] for x in every}
    check({'people', 'companies', 'projects', 'clients'} <= kinds, 'search_everything kinds: %r' % kinds)

    # ---- Ask the base panel answers through the same tool ----
    open_palette(p, 'tata')
    p.locator('.pal-item.more', has_text='Show all').click()
    p.wait_for_selector('#ask-base')
    p.fill('#ask-base-input', 'Who do we know at Tata Motors')
    p.keyboard.press('Enter')
    p.wait_for_selector('#ask-base .ai-out:has-text("Arjun Sethi")', timeout=10000)
    p.keyboard.press('Escape')

    # ---- quiet leads and nudges ----
    quiet = h.ctx(p, 'M.intel.quietLeads(ctx).map(c => c.id)')
    check(quiet == ['c1'], 'quietLeads: %r' % quiet)
    quiet10 = h.ctx(p, 'M.intel.quietLeads(ctx, 1).map(c => c.id).sort()')
    check(quiet10 == ['c1', 'c2', 'c4'], 'quietLeads with 1 day: %r' % quiet10)
    sugg = h.ctx(p, 'M.intel.suggestions(ctx).map(s => s.k)')
    check('quiet' in sugg and 'org:o1' in sugg, 'suggestions: %r' % sugg)
    text = h.ctx(p, 'M.intel.suggestions(ctx).map(s => s.text).join(" ")')
    check('Priya Iyer' in text and 'Tata Motors' in text, 'suggestion copy: %r' % text)
    # the parts exist for the Base page and HQ
    parts = h.ctx(p, '["Connections", "AskBase", "BaseNudges", "SearchAll"].filter(k => typeof M.parts[k] === "function").length')
    check(parts == 4, 'exports missing: %r' % parts)

    # ---- privacy: m1 searching "leave" sees only their own leave, nothing of m2 ----
    h.go(p, 'm1', hash='#home', width=1280)
    p.wait_for_selector('.side-tools')
    open_palette(p, 'leave')
    p.wait_for_selector('.pal-item')
    lst = p.inner_text('#pal-list')
    m2range = p.evaluate('() => M.leave.rangeText(window.__db.get("leave/u_m2").reqs[0])')
    check('Aanya' not in lst and m2range not in lst and p.locator('.pal-item[data-group="leave"]').count() == 0, 'm2 leave detail leaked to m1: %r' % lst)
    check('late' not in lst.lower(), 'late marks leaked through search: %r' % lst)
    p.keyboard.press('Escape')
    # m1's own request shows up for m1
    h.go(p, 'm2', hash='#home', width=1280)
    p.wait_for_selector('.side-tools')
    open_palette(p, 'leave')
    p.wait_for_selector('.pal-item[data-group="leave"]')
    check('pending' in p.locator('.pal-item[data-group="leave"]').first.inner_text(), 'own leave request missing for m2')
    p.keyboard.press('Escape')

    # ---- 390: the search drawer fits, no sideways scroll ----
    h.go(p, 'm1', hash='#home', width=390)
    p.wait_for_selector('.topbar .bellbtn')
    p.locator('.topbar').get_by_role('button', name='Search').click()
    p.wait_for_selector('#pal-input')
    p.fill('#pal-input', 'swisse')
    p.wait_for_selector('.pal-item.more')
    p.locator('.pal-item.more', has_text='Show all').click()
    p.wait_for_selector('#search-all')
    box = p.locator('.drawer').bounding_box()
    check(box['x'] >= 0 and box['x'] + box['width'] <= 390, 'search drawer off screen at 390: %r' % box)
    ov = h.overflow(p)
    check(ov <= 0, 'phone overflow %d' % ov)
    check(p.locator('#search-all .fold, #search-all .conn-row').count() >= 1, 'drawer rows missing at 390')
    h.shot(p, 'search-390')
    p.keyboard.press('Escape')
    # connections fold on a phone
    h.go(p, 'm1', hash='#projects/p1', width=390)
    p.wait_for_selector('#fold-connections')
    p.locator('#fold-connections .fold-head').click()
    p.wait_for_selector('#connections')
    check(h.overflow(p) <= 0, 'project connections overflow at 390')

    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
