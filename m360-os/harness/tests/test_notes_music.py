#!/usr/bin/env python3
"""Notes, music and notices on the mock: a private note saves itself as you type and survives a reload,
pins sort first, another person sees none of it; a Spotify link becomes a card, Play puts it in a dock
that survives moving to Home, Stop clears it; the notice prefs in Me switch previews and room notices.

Run: cd m360-os && python3 harness/tests/test_notes_music.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from harness.lib import run  # noqa: E402
from harness.qa import seed  # noqa: E402


def test(h):
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)
    p = h.session('founder', width=1280, height=820, hash='#home', reset=True, seed=True)
    seed(h, p)
    h.roster(p, ('u_m1',))
    # ---- notes ----
    h.go(p, 'founder', hash='#notes', width=1280)
    p.wait_for_selector('#notes-new')
    check('yours alone' in p.inner_text('#notes-list'), 'an empty notebook says so')
    p.locator('#notes-new').click()
    p.wait_for_selector('#note-text')
    p.fill('#note-text', 'Shoot list for Swisse\nlights, lenses, the good tripod')
    p.wait_for_selector('.note-row:has-text("Shoot list for Swisse")', timeout=6000)
    check('words' in p.inner_text('.note-foot'), 'a word count')
    p.locator('#note-pin').click()
    p.wait_for_selector('.note-row .note-pinned')
    p.locator('#notes-new').click()
    p.wait_for_function('() => document.querySelectorAll(".note-row").length === 2')
    p.fill('#note-text', 'Second thought')
    p.wait_for_selector('.note-row:has-text("Second thought")', timeout=6000)
    rows = p.locator('.note-row').all_inner_texts()
    check('Shoot list' in rows[0], 'the pinned note sorts first, got %r' % rows)
    # a reload keeps the text
    h.go(p, 'founder', hash='#notes', width=1280)
    p.wait_for_selector('.note-row:has-text("Shoot list for Swisse")')
    p.locator('.note-row:has-text("Shoot list for Swisse")').click()
    p.wait_for_function('() => (document.querySelector("#note-text") || {}).value && document.querySelector("#note-text").value.includes("good tripod")')
    p.fill('#notes-q', 'second')
    p.wait_for_function('() => document.querySelectorAll(".note-row").length === 1')
    # another person sees nothing of it
    h.go(p, 'm1', hash='#notes', width=1280)
    p.wait_for_selector('#notes-new')
    check(p.locator('.note-row').count() == 0 and 'yours alone' in p.inner_text('#notes-list'), 'notes are private')
    # phone: the list, then the page
    h.go(p, 'founder', hash='#notes', width=390)
    p.wait_for_selector('#notes-list')
    p.locator('.note-row').first.click()
    p.wait_for_selector('#note-text')
    check(p.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, 'no sideways scroll on the phone')
    # delete
    h.go(p, 'founder', hash='#notes', width=1280)
    p.wait_for_selector('.note-row:has-text("Second thought")')
    p.locator('.note-row:has-text("Second thought")').click()
    p.wait_for_selector('#note-text')
    p.get_by_role('button', name='Delete').click()
    p.get_by_role('button', name='Tap again to confirm').click()
    p.wait_for_function('() => !Array.from(document.querySelectorAll(".note-row")).some(r => r.textContent.includes("Second thought"))')
    # ---- music ----
    h.go(p, 'founder', hash='#music', width=1280)
    p.wait_for_selector('#music-link')
    check(p.locator('#music-save').is_disabled(), 'Add waits for a real link')
    p.fill('#music-link', 'https://example.com/not-music')
    check(p.locator('#music-save').is_disabled(), 'a link that is not music stays disabled')
    p.fill('#music-link', 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc')
    p.fill('#music-title', 'Friday closer')
    p.locator('#music-save').click()
    p.wait_for_selector('.music-card:has-text("Friday closer")')
    p.fill('#music-link', 'https://youtu.be/dQw4w9WgXcQ'); p.locator('#music-save').click()
    p.wait_for_function('() => document.querySelectorAll(".music-card").length === 2')
    p.locator('.music-card:has-text("Friday closer")').get_by_role('button', name='Play').click()
    p.wait_for_selector('#music-dock')
    src = p.evaluate('() => document.querySelector("#music-dock .music-frame").getAttribute("src")')
    check(src.startswith('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'), 'the dock plays the embed, got %r' % src)
    check(p.locator('.music-card.playing').count() == 1, 'the playing card is marked')
    # the dock survives moving around
    p.evaluate('() => M.nav("#home")')
    p.wait_for_selector('#home-hero')
    check(p.locator('#music-dock').count() == 1, 'the dock stays while you move around')
    p.locator('#music-dock .music-dock-title').click()
    p.wait_for_selector('#music-dock.folded')
    p.locator('#music-dock').get_by_role('button', name='Stop').click()
    p.wait_for_function('() => !document.querySelector("#music-dock")')
    # the list is the team's
    h.go(p, 'm1', hash='#music', width=1280)
    p.wait_for_selector('.music-card:has-text("Friday closer")')
    check(p.locator('.music-card:has-text("Friday closer") .iconbtn').count() == 0, 'only the person who added it, or the founder, removes it')
    # youtube goes to the no-cookie embed
    yt = p.evaluate('() => M.music.embedOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123").embed')
    check(yt.startswith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ') and 'list=PL123' in yt, 'youtube embed, got %r' % yt)
    ap = p.evaluate('() => M.music.embedOf("https://music.apple.com/in/album/x/1?i=2").embed')
    check(ap.startswith('https://embed.music.apple.com/in/album/x/1'), 'apple embed, got %r' % ap)
    # ---- notices and the prefs ----
    h.go(p, 'founder', hash='#me', width=1280)
    p.wait_for_selector('#fold-prefs, #prefs-card')
    if p.locator('#fold-prefs .fold-head[aria-expanded="false"]').count():
        p.locator('#fold-prefs .fold-head').click()
    p.wait_for_selector('#prefs-card')
    p.get_by_label('Message previews').get_by_role('tab', name='Hide').click()
    check(p.evaluate('() => M.notices.previews()') is False, 'previews off')
    p.evaluate('() => M.notices.push({key: "t1", who: "u_m1", title: "Durvesh", body: "the deck is with you", href: "#chat"})')
    p.wait_for_selector('#notices .notice')
    nt = p.inner_text('#notices .notice')
    check('Durvesh' in nt and 'deck' not in nt and 'New message' in nt, 'a notice with previews off shows who only, got %r' % nt)
    p.get_by_label('Message previews').get_by_role('tab', name='Show').click()
    p.evaluate('() => M.notices.push({key: "t2", who: "u_m1", title: "Durvesh", body: "second line", href: "#chat"})')
    p.wait_for_selector('#notices .notice:has-text("second line")')
    check(p.locator('#notices .notice').count() == 2, 'notices stack')
    p.locator('#notices .notice:has-text("second line") .notice-x').click()
    p.wait_for_function('() => document.querySelectorAll("#notices .notice").length === 1')
    p.get_by_label('Room notices').get_by_role('tab', name='On').click()
    check(p.evaluate('() => M.rooms.noticeAll()') is True, 'room notices on')
    p.get_by_label('Room notices').get_by_role('tab', name='Off').click()
    # they slide away on their own
    p.wait_for_function('() => !document.querySelector("#notices")', timeout=9000)
    errs = [e for e in h.errors() if 'AudioContext' not in str(e) and 'play()' not in str(e) and 'net::' not in str(e) and 'spotify' not in str(e).lower() and 'youtube' not in str(e).lower()]
    check(not errs, 'console errors: %r' % errs[:3])
    return fails


if __name__ == '__main__':
    fails = run(test)
    print('PASS' if not fails else 'FAIL: ' + '; '.join(fails))
