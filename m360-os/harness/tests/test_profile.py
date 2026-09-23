#!/usr/bin/env python3
"""v5 profile test: a member fills in pronouns, city, bio, a link, a phone number and a photo on Me,
the photo lands in me/<uid> as a small JPEG and shows on every avatar, teammates see the details on
the Person page and the city on the crew list, links that will not do are refused, the photo can be
removed, and the phone layout holds at 390.

Run: cd m360-os && python3 harness/tests/test_profile.py
"""
import os
import struct
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402


def make_png(w=120, h=80):
    """A small RGB gradient PNG, built by hand so the test needs no image library."""
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            row += bytes(((x * 255) // w, (y * 255) // h, 120))
        rows.append(bytes(row))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b''))


def t(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    def doc(p, path):
        return p.evaluate('window.__db.get("%s")' % path)

    def overflow(p):
        return p.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')

    p = h.session('m1', width=1280, hash='#me', reset=True, seed=True)
    seed(h, p)
    h.go(p, 'm1', hash='#me', width=1280)
    p.wait_for_selector('#profile-card')
    card = p.inner_text('#profile-card')
    check('Your profile' in card and 'Durvesh Patil' in card and 'Brand Strategist' in card, 'profile card head: ' + card[:200])
    check('Your name comes from your Claude account.' in card, 'name hint missing on the Claude build')
    check(p.locator('#profile-card #about-card input[type="date"]').count() == 1, 'the birthday field left the profile card')
    check(p.locator('.card#about-card').count() == 0, 'the old about card still renders on its own')
    save = p.locator('#profile-save')
    check(save.is_disabled(), 'save is enabled before anything changed')

    # ---- fill in the profile and pick a photo ----
    p.fill('#profile-pronouns', 'he/him')
    p.fill('#profile-city', 'Mumbai')
    p.fill('#profile-bio', 'Strategy for luxury brands. Reels by day, filter coffee by night.')
    p.fill('#profile-askme', 'Reels, Goa, typography')
    p.fill('#profile-phone', '+91 98200 11223')
    p.fill('#profile-instagram', '@durvesh.p')
    p.fill('#profile-portfolio', 'durvesh.design')
    p.set_input_files('#profile-photo', {'name': 'me.png', 'mimeType': 'image/png', 'buffer': make_png()})
    p.wait_for_function('() => (document.querySelector("#profile-card .prof-preview img.av") || {}).src.startsWith("data:image/jpeg")')
    preview = p.inner_text('#profile-card .prof-preview')
    check('he/him' in preview and 'Mumbai' in preview, 'live preview: ' + preview)
    check(not save.is_disabled(), 'save stayed disabled after edits')
    check(doc(p, 'me/u_m1') is None or not (doc(p, 'me/u_m1') or {}).get('photo'), 'photo written before save')
    save.click()
    p.wait_for_function('() => ((window.__db.get("me/u_m1") || {}).photo || "").startsWith("data:image/jpeg")')
    me = doc(p, 'me/u_m1')
    check(len(me['photo']) <= 40 * 1024, 'photo over 40 KB: %d' % len(me['photo']))
    for k, v in (('pronouns', 'he/him'), ('city', 'Mumbai'), ('askMe', 'Reels, Goa, typography'), ('phone', '+91 98200 11223'),
                 ('instagram', '@durvesh.p'), ('portfolio', 'durvesh.design')):
        check(me.get(k) == v, 'me.%s = %r' % (k, me.get(k)))
    check(me.get('bio', '').startswith('Strategy for luxury brands'), 'bio not saved: %r' % me.get('bio'))
    check('name' not in me and 'email' not in me, 'profile document carries a name or an email')
    p.wait_for_function('() => document.querySelector("#profile-save").disabled')
    # every avatar for m1 now shows the photo: the sidebar, the Me hero
    p.wait_for_function('() => document.querySelector(".side-foot img.av").src === (window.__db.get("me/u_m1") || {}).photo')
    check(p.locator('.hero img.av').first.get_attribute('src') == me['photo'], 'Me hero avatar did not pick up the photo')
    h.shot(p, 'profile-me')

    # ---- a link that will not do is refused, nothing written ----
    p.fill('#profile-linkedin', 'not a link')
    p.locator('#profile-save').click()
    p.wait_for_selector('.toast.err')
    check('linkedin' in p.inner_text('.toast.err'), 'bad link toast: ' + p.inner_text('.toast.err'))
    check(doc(p, 'me/u_m1').get('linkedin', '') == '', 'bad link was written')
    p.fill('#profile-linkedin', '')

    # ---- the founder sees the details on the Person page and the city on the crew list ----
    h.go(p, 'founder', hash='#people/u_m1', width=1280)
    p.wait_for_selector('#person-head')
    head = p.inner_text('#person-head')
    check('he/him' in head, 'pronouns missing on the person page')
    check('Mumbai' in head, 'city missing on the person page')
    check('Strategy for luxury brands' in head, 'bio missing on the person page')
    check('Reels, Goa, typography' in head, 'ask me about missing on the person page')
    ig = p.locator('#person-head a.prof-link[href="https://instagram.com/durvesh.p"]')
    check(ig.count() == 1 and '@durvesh.p' in ig.inner_text(), 'instagram link missing or wrong')
    check(p.locator('#person-head a.prof-link[href="https://durvesh.design"]').count() == 1, 'portfolio link missing')
    check(p.locator('#person-head a[href="tel:+919820011223"]').count() == 1, 'phone is not a tel link')
    check(p.locator('#person-head img.av').first.get_attribute('src') == me['photo'], 'person page avatar did not pick up the photo')
    # private detail stays private: the founder sees the scorecard tabs, a teammate does not
    h.shot(p, 'profile-person')
    h.go(p, 'founder', hash='#people', width=1280)
    p.wait_for_selector('#people-grid')
    check(p.locator('#people-grid .person-city', has_text='Mumbai').count() == 1, 'city missing on the crew card')
    h.go(p, 'm2', hash='#people/u_m1', width=1280)
    p.wait_for_selector('#person-head')
    body = p.inner_text('#person-head')
    check('Mumbai' in body and 'Strategy for luxury brands' in body, 'teammate does not see the profile')
    check(p.get_by_role('tab', name='Scorecard').count() == 0, 'teammate sees the scorecard')

    # ---- remove the photo ----
    h.go(p, 'm1', hash='#me', width=1280)
    p.wait_for_selector('#profile-card')
    p.locator('#profile-card').get_by_role('button', name='Remove photo').click()
    p.locator('#profile-save').click()
    p.wait_for_function('() => (window.__db.get("me/u_m1") || {}).photo === ""')
    p.wait_for_function('() => !document.querySelector(".side-foot img.av").src.startsWith("data:image/jpeg")')
    check(doc(p, 'me/u_m1').get('city') == 'Mumbai', 'removing the photo lost the other fields')

    # ---- phone ----
    h.go(p, 'm1', hash='#me', width=390)
    p.wait_for_selector('#profile-card')
    check(overflow(p) <= 0, 'me overflow at 390: %d' % overflow(p))
    h.shot(p, 'profile-me-390')
    h.go(p, 'founder', hash='#people/u_m1', width=390)
    p.wait_for_selector('#person-head')
    check(overflow(p) <= 0, 'person overflow at 390: %d' % overflow(p))

    errs = [e for e in h.errors() if 'AudioContext' not in str(e)]
    check(not errs, 'console errors: %r' % errs[:3])
    return 'PASS' if not fails else 'FAIL: ' + '; '.join(fails)


print(run(t))
