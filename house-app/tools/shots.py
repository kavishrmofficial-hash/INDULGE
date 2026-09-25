#!/usr/bin/env python3
"""Screenshot the review build: every screen at phone size, plus the desktop stage.
Usage: python3 tools/shots.py [outdir]   (default shots/)"""
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'shots')
URL = 'file://' + os.path.join(ROOT, 'index.html')
SCREENS = [('00-door', 'gate', None, False), ('01-application', 'application', None, False), ('02-today', 'today', None, True),
           ('03-form', 'form', None, True), ('04-book', 'book', None, True), ('05-whats-on', 'events', None, True),
           ('06-event', 'event', 'track', True), ('07-connect', 'connect', None, True), ('08-member', 'profile', 'zara', True),
           ('09-messages', 'messages', None, True), ('10-concierge', 'thread', 'concierge', True), ('11-key', 'key', None, True),
           ('12-guests', 'guests', None, True), ('13-ledger', 'ledger', None, True), ('14-houses', 'houses', None, True),
           ('15-nominate', 'nominate', None, True), ('16-settings', 'settings', None, True), ('17-notifications', 'notifications', None, True)]

def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.goto(URL); page.wait_for_timeout(1200)
        for name, view, param, unlocked in SCREENS:
            page.evaluate("s => localStorage.setItem('atenx-house.v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('atenx-house.v1')||'{}'), s)))",
                          {'view': view, 'param': param, 'unlocked': unlocked, 'stack': []})
            page.reload(); page.wait_for_timeout(1400)
            page.screenshot(path=os.path.join(OUT, name + '.png'))
            print(name)
        ctx.close()
        d = b.new_context(viewport={'width': 1280, 'height': 940}, device_scale_factor=1)
        page = d.new_page(); page.goto(URL); page.wait_for_timeout(1200)
        page.evaluate("s => localStorage.setItem('atenx-house.v1', JSON.stringify(s))", {'view': 'today', 'unlocked': True, 'stack': []})
        page.reload(); page.wait_for_timeout(1400)
        page.screenshot(path=os.path.join(OUT, 'desktop-stage.png')); print('desktop-stage')
        b.close()

if __name__ == '__main__':
    main()
