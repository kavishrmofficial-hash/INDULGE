"""Money lock (01-z-moneylock.js): on the owner's and founders' screens every amount is masked until a fingerprint.

Runs on the real dev server (harness/sim/office_env.py, served on localhost so WebAuthn has a valid RP id) with
Chrome's virtual authenticator standing in for Touch ID.
- the owner's Command shows no amount, only the mask; Books shows the lock card in place of its pages
- the fingerprint opens it: the first time makes a key on this device, later times check it
- Hide now masks again; the Ask bar row follows; Me, Prefs carries the switch and Off asks first
- a member never meets the lock; the phone shows the card with no sideways scroll
- a cancelled fingerprint leaves everything hidden
"""
import os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from harness.sim.office_env import Office

AMOUNT = re.compile(r'₹\s?\d')
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


def finger(pg, verified=True):
    cdp = pg.context.new_cdp_session(pg)
    cdp.send('WebAuthn.enable', {'enableUI': False})
    a = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True,
                                                                  'hasUserVerification': True, 'isUserVerified': verified, 'automaticPresenceSimulation': True}})
    return cdp, a['authenticatorId']


def shown_text(pg):
    return pg.evaluate('() => document.querySelector("#root").innerText')


with Office(users=6, warm=10) as o:
    pg = o.page('founder', width=1280, height=900, money_lock=True)
    pg.set_default_timeout(20000)
    cdp, aid = finger(pg)
    pg.goto(o.base + '#hq'); pg.wait_for_selector('#c-need', state='attached'); pg.wait_for_timeout(1500)
    check(pg.evaluate('() => M.moneyLock.hidden()'), 'the owner starts hidden')
    check(pg.evaluate('() => document.documentElement.classList.contains("money-hidden")'), 'the page carries money-hidden')
    t = shown_text(pg)
    check(not AMOUNT.search(t), 'Command shows no amount while hidden: %r' % (AMOUNT.findall(t)[:3],))
    check(pg.evaluate('() => U.inrV(125000)') == '₹ ••••' if pg.evaluate('() => !!window.U') else pg.evaluate('() => M.U.inrV(125000)') == '₹ ••••', 'U.inrV masks')
    check(pg.evaluate('() => M.U.inr(125000)') == '₹' + '1,25,000', 'U.inr stays the real figure for documents and the AI')
    check(pg.evaluate('() => M.moneyLock.mask("Books for Oct: billed ₹1,20,000, spent $3,400.50")') == 'Books for Oct: billed ₹ ••••, spent ₹ ••••', 'mask covers any amount in a line')

    # Books: the card in place of its pages
    pg.goto(o.base + '#books'); pg.wait_for_selector('#money-gate')
    check(pg.locator('#money-gate').count() == 1 and 'hidden' in pg.inner_text('#money-gate'), 'Books shows the lock card')
    check(not AMOUNT.search(shown_text(pg)), 'no amount on the Books card')
    o.problems(pg)

    # the fingerprint: first time makes a key, and shows
    pg.click('#money-unlock')
    pg.wait_for_function('() => !M.moneyLock.hidden()', timeout=15000)
    pg.wait_for_function('() => !document.getElementById("money-gate")')
    check(pg.evaluate('() => !!localStorage.getItem("m360.moneyLockKey")'), 'a key is kept on this device')
    check(cdp.send('WebAuthn.getCredentials', {'authenticatorId': aid})['credentials'].__len__() == 1, 'one credential made')
    check(not pg.evaluate('() => document.documentElement.classList.contains("money-hidden")'), 'money-hidden comes off')
    pg.wait_for_timeout(800)
    check(AMOUNT.search(shown_text(pg)) is not None, 'Books shows real amounts once open')

    # Hide now, and the Ask bar row
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(400); pg.keyboard.type('money'); pg.wait_for_selector('.pal-item[data-k="a-money"]')
    check('Hide money' in pg.inner_text('.pal-item[data-k="a-money"]'), 'the Ask bar offers Hide money now')
    pg.click('.pal-item[data-k="a-money"]'); pg.wait_for_timeout(600)
    check(pg.evaluate('() => M.moneyLock.hidden()'), 'Hide money now masks again')
    pg.goto(o.base + '#hq'); pg.wait_for_timeout(1200)
    check(not AMOUNT.search(shown_text(pg)), 'Command masked again')

    # a tap on a masked amount asks again, with the kept key (get, not create)
    masked = pg.locator('#root :text("₹ ••••")').first
    if masked.count():
        masked.click()
    else:
        pg.evaluate('() => M.moneyLock.unlock()')
    pg.wait_for_function('() => !M.moneyLock.hidden()', timeout=15000)
    check(cdp.send('WebAuthn.getCredentials', {'authenticatorId': aid})['credentials'].__len__() == 1, 'the second time checks the same key')
    check(pg.evaluate('location.hash') == '#hq', 'tapping a masked amount does not navigate')

    # Me, Prefs: the switch; Off asks first, then amounts show for everyone looking
    pg.evaluate('() => M.moneyLock.hide()')
    pg.goto(o.base + '#me'); pg.wait_for_selector('#prefs-money')
    check('Hide money until fingerprint' in pg.inner_text('#prefs-money'), 'Me, Prefs carries the switch')
    pg.locator('#prefs-money').get_by_role('radio', name='Off').or_(pg.locator('#prefs-money button:has-text("Off")')).first.click()
    pg.wait_for_function('() => !M.moneyLock.on()', timeout=15000)
    check(pg.evaluate('() => localStorage.getItem("m360.moneyLock")') == '0', 'Off is kept on this device')
    pg.locator('#prefs-money').get_by_role('radio', name='On').or_(pg.locator('#prefs-money button:has-text("On")')).first.click()
    pg.wait_for_function('() => M.moneyLock.hidden()')
    check(True, 'On hides straight away')
    check(o.problems(pg) == [], 'no console errors on the founder')

    # a cancelled fingerprint keeps it hidden
    cdp.send('WebAuthn.setUserVerified', {'authenticatorId': aid, 'isUserVerified': False})
    r = pg.evaluate('() => M.moneyLock.unlock()')
    check(r is False and pg.evaluate('() => M.moneyLock.hidden()'), 'a failed fingerprint leaves it hidden')
    pg.close()

    # a member never meets the lock
    m = o.page('member', width=1280, height=900, money_lock=True)
    m.goto(o.base + '#home'); m.wait_for_timeout(2000)
    check(not m.evaluate('() => M.moneyLock.active()'), 'the lock is off for a member')
    check(m.locator('#prefs-money').count() == 0, 'a member has no switch')
    m.close()

    # the phone: the card fits
    ph = o.page('founder', width=390, height=844, money_lock=True)
    ph.goto(o.base + '#books'); ph.wait_for_selector('#money-gate')
    ov = ph.evaluate('() => document.documentElement.scrollWidth - innerWidth')
    check(ov <= 0, 'phone: no sideways scroll on the card (%d)' % ov)
    ph.goto(o.base + '#hq'); ph.wait_for_timeout(1500)
    check(not AMOUNT.search(shown_text(ph)), 'phone Command masked')
    check(o.problems(ph) == [], 'no console errors on the phone')

print('PASS' if not fails else 'FAIL %d' % len(fails))
sys.exit(1 if fails else 0)
