#!/usr/bin/env python3
"""A big Base on the team site: an Apollo export of 26,000 people (30 MB, long keyword lists) imports without freezing the
page, every page of it reaches a second browser in rounds that stay under the sync budget, and after
that an edit to one person costs one page document on the wire, never the whole collection.

Run: cd m360-os && python3 harness/tests/test_bigbase.py
"""
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import build_edgeone  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROWS = 26000
GEN = '''(n) => {
  const cols = ['First Name','Last Name','Title','Company','Company Name for Emails','Email','Email Status','Seniority','Departments','Contact Owner','Work Direct Phone','Mobile Phone','Stage','Lists','# Employees','Industry','Keywords','Person Linkedin Url','Website','Company Linkedin Url','City','State','Country','Company City','Company State','Company Country','Company Phone','SEO Description','Technologies','Annual Revenue','Apollo Contact Id','Apollo Account Id','Secondary Email'];
  const lines = [cols.map(c => '"' + c + '"').join(',')];
  const inds = ['Luxury Goods','Retail','Hospitality','Real Estate','Marketing','Media'];
  for (let i = 0; i < n; i++) {
    const co = 'Company ' + (i % 9000);
    const kw = new Array(120).fill(0).map((_, k) => 'keyword number ' + k + ' for ' + (i % 9000)).join(', ');
    const r = ['Person' + i, 'Surname' + (i % 700), 'Head of Marketing, Brand', co, co, 'person' + i + '@company' + (i % 9000) + '.com', 'Verified', 'Director', 'Marketing', 'kaavish@mask360.agency', '+91 98' + String(i).padStart(8, '0'), '', 'Cold', 'Q4 luxury, Mumbai', String(50 + i % 900), inds[i % 6], kw, 'https://linkedin.com/in/person' + i, 'https://company' + (i % 9000) + '.com', '', 'Mumbai', 'Maharashtra', 'India', 'Mumbai', 'Maharashtra', 'India', '+91 22 1234', 'A description with, commas and "quotes" inside the SEO text of the company that goes on for a while', 'Shopify, Klaviyo', '5M', 'ac' + i, 'aa' + (i % 9000), ''];
    lines.push(r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
  }
  return lines.join('\\n');
}'''


def main():
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    build_edgeone.main()
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    store = tempfile.mktemp(suffix='.json')
    srv = subprocess.Popen(['node', os.path.join(ROOT, 'edgeone', 'dev', 'server.mjs'), str(port), store], env=dict(os.environ, MOCK_AI='1'), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
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
            k = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page(); k.set_default_timeout(60000)
            errs = []
            k.on('pageerror', lambda e: errs.append(str(e)))
            k.goto(base); k.wait_for_selector('#signin-name')
            k.fill('#signin-name', 'Kaavish Ramchandani'); k.fill('#signin-email', 'kaavish@mask360.agency'); k.fill('#signin-pw', 'bigbase-test-pw-1')
            k.get_by_role('button', name='Set up the workspace').click(); k.wait_for_selector('.sidebar'); k.wait_for_timeout(400)
            k.goto(base + '#import'); k.wait_for_selector('#import-file')
            # the file, parsed and planned in the page, then written the way the Import button does it
            t0 = time.time()
            r = k.evaluate('''async (gen) => {
              const make = eval(gen);
              const text = make(%d);
              const t1 = performance.now();
              /* the file the way the page reads it: in slices, only the mapped columns kept */
              const parsed = await M.base.readCsvFile(new File([text], 'apollo-contacts-export.csv', {type: 'text/csv'}));
              const mapping = M.base.mapApollo(parsed.headers);
              const plan = M.base.planImport(M.lastCtx, parsed, mapping, () => '');
              const t2 = performance.now();
              window.__long = 0; window.__prog = [];
              try { new PerformanceObserver(l => l.getEntries().forEach(e => { window.__long = Math.max(window.__long, e.duration); })).observe({entryTypes: ['longtask']}); } catch (e) { /* none */ }
              await M.base.runImport(M.lastCtx, plan, p => window.__prog.push(p));
              const t3 = performance.now();
              const biggest = Math.max(...['contacts', 'orgs'].flatMap(c => Object.keys(plan.pages[c]).map(k => JSON.stringify(plan.pages[c][k]).length)));
              return {bytes: text.length, rows: parsed.rows.length, kept: parsed.kept.size, added: plan.added, orgs: plan.orgsNew, pages: Object.keys(plan.pages.contacts).length + Object.keys(plan.pages.orgs).length, biggest, prep: Math.round(t2 - t1), write: Math.round(t3 - t2), longest: Math.round(window.__long), steps: window.__prog.length};
            }''' % ROWS, GEN)
            print('import', r, 'wall %.1fs' % (time.time() - t0))
            check(r['rows'] == ROWS and r['added'] == ROWS and r['pages'] >= 170, 'the plan covers every row: %r' % r)
            check(r['biggest'] <= 200 * 1024, 'every page must stay under the document limit, biggest %r bytes' % r['biggest'])
            check(r['kept'] < 33, 'only the mapped columns are kept, got %r' % r['kept'])
            check(r['longest'] < 2500, 'the page froze for %r ms while writing' % r['longest'])
            check(r['steps'] >= r['pages'], 'progress should be reported per page, got %r for %r pages' % (r['steps'], r['pages']))
            # the founder's own page holds everything once the writes settle
            k.wait_for_function('n => M.base.all(M.lastCtx).contacts.length === n', arg=ROWS, timeout=60000)
            check(k.evaluate('() => M.base.all(M.lastCtx).orgs.length') == 9000, 'companies folded to 9000')
            # the protocol: a page with nothing gets the collection in rounds under the budget, not one answer
            rounds = k.evaluate('''async () => {
              let tags = {}, rounds = 0, docs = 0, biggest = 0, more = true;
              while (more && rounds < 60) {
                const r = await window.M360_API('snapshot', {tags});
                rounds++;
                let size = 0;
                for (const c of Object.keys(r.colls)) { const x = r.colls[c]; tags[c] = Object.assign(tags[c] || {}, x.tags); docs += Object.keys(x.docs).length; size += JSON.stringify(x.docs).length; }
                biggest = Math.max(biggest, size);
                more = !!r.more;
              }
              window.__tags = tags;
              return {rounds, docs, biggest, contactsPages: Object.keys(tags.contacts || {}).length};
            }''')
            print('rounds', rounds)
            check(rounds['rounds'] >= 3 and rounds['biggest'] <= 2600000, 'a big collection should come in rounds under the budget, got %r' % rounds)
            check(rounds['contactsPages'] >= 130, 'contacts pages held: %r' % rounds['contactsPages'])
            # an edit to one person: the next sync carries that one page and nothing else
            one = k.evaluate('''async () => {
              const c = M.base.all(M.lastCtx).contacts[123];
              await M.base.upsertContact(M.lastCtx, {id: c.id, title: 'VP Brand'});
              const tags = window.__tags; const pid = M.base.pageFor(M.lastCtx, 'contacts', c.id);
              const r = await window.M360_API('sync', {tags});
              const colls = Object.keys(r.colls).filter(k => Object.keys(r.colls[k].docs).length || r.colls[k].gone.length);
              return {pid, colls, contactDocs: r.colls.contacts ? Object.keys(r.colls.contacts.docs) : [], more: !!r.more};
            }''')
            print('one edit', one)
            check(one['contactDocs'] == [one['pid']] and not one['more'], 'one edit should cost one page: %r' % one)
            check(all(c in ('contacts', 'log') for c in one['colls']), 'nothing else should travel for one edit: %r' % one['colls'])
            # a second browser loads the whole base and sees that edit
            t1 = time.time()
            d = browser.new_context(viewport={'width': 1280, 'height': 900}).new_page(); d.set_default_timeout(60000)
            d.goto(base); d.wait_for_selector('#signin-email')
            d.fill('#signin-email', 'kaavish@mask360.agency'); d.fill('#signin-pw', 'bigbase-test-pw-1'); d.locator('#signin-go').click()
            d.wait_for_selector('.sidebar')
            d.wait_for_function('n => M.base.all(M.lastCtx).contacts.length === n', arg=ROWS, timeout=60000)
            print('second browser loaded in %.1fs' % (time.time() - t1))
            check(d.evaluate('() => M.base.all(M.lastCtx).contacts.some(c => c.title === "VP Brand")'), 'the edit reached the second browser')
            d.goto(base + '#base'); d.wait_for_selector('.bs-row')
            check(not errs, 'page errors: %r' % errs[:3])
            browser.close()
    finally:
        srv.terminate()
        try:
            os.remove(store)
        except Exception:
            pass
    return fails


if __name__ == '__main__':
    fails = main()
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
