"""Line-art illustrations for the v4 deck, drawn in SVG. Colours come from the deck's CSS classes:
ln (ink line), ln2 (fine grey line), lnp (plan-green line), fp (plan tint fill), fi (ink fill), fw (paper fill), fpanel (panel fill)."""
import math
from html import escape as esc


def _none(*a, **k):
    return ''


def _t(x, y, s, size=12, cls='', anchor='start', weight=400, ls=0, italic=False, fill=None):
    st = f'font-size:{size}px;font-weight:{weight}' + (f';letter-spacing:{ls}em' if ls else '') + (';font-style:italic' if italic else '')
    f = f' style="{st}{";fill:" + fill if fill else ""}"'
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="{cls}"{f}>{esc(s)}</text>'


def window(story_title='Rahul & Anjali', story_line='Getting ready. The date is at eight.', left='Anjali', right='Rahul', labels=True):
    """Two dress forms in a shop window, a vanity mirror between them, a wall clock at 7:45. labels=False drops the text (small sizes)."""
    _t = globals()['_t'] if labels else _none
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a Westside window with two dress forms styled as '
         f'{esc(right)} and {esc(left)} getting ready for a date, a mirror between them and a clock at a quarter to eight">']
    # window frame and glass
    o.append('<rect class="fpanel" x="40" y="40" width="720" height="460"/>')
    o.append('<rect class="ln" x="40" y="40" width="720" height="460"/>')
    o.append('<rect class="ln2" x="52" y="52" width="696" height="436"/>')
    o.append('<line class="ln2" x1="52" y1="452" x2="748" y2="452"/>')
    # glass decal
    o.append(_t(78, 98, story_title, 30, 'tx-d', italic=True))
    o.append(_t(79, 122, story_line, 13, ls=.02))
    o.append(_t(79, 144, 'A WESTSIDE WINDOW STORY', 11, weight=500, ls=.18, fill='var(--ink-3)'))
    # wall clock at 7:40
    o.append('<circle class="fw" cx="668" cy="112" r="30"/><circle class="ln" cx="668" cy="112" r="30"/>')
    for i in range(12):
        a = math.radians(i * 30)
        x1, y1 = 668 + 25 * math.sin(a), 112 - 25 * math.cos(a)
        x2, y2 = 668 + 28 * math.sin(a), 112 - 28 * math.cos(a)
        o.append(f'<line class="ln2" x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>')
    o.append('<line class="ln" x1="668" y1="112" x2="656.1" y2="121.1"/>')  # hour hand, 7:45
    o.append('<line class="ln" x1="668" y1="112" x2="645" y2="112"/>')      # minute hand at 45
    # ANJALI: dress form with a flared dress, cx 250
    o.append('<ellipse class="ln" cx="250" cy="150" rx="11" ry="3.5"/>')
    o.append('<path class="ln" d="M239 150 L241 166 M261 150 L259 166"/>')
    dress = ('M241 166 C222 168 206 174 200 186 C196 196 202 214 210 230 C216 246 220 262 222 276 '
             'C210 318 190 372 168 430 Q250 446 332 430 C310 372 290 318 278 276 '
             'C280 262 284 246 290 230 C298 214 304 196 300 186 C294 174 278 168 259 166 Z')
    o.append(f'<path class="fp" d="{dress}"/><path class="ln" d="{dress}"/>')
    o.append('<path class="ln" d="M214 180 Q250 222 286 180"/>')            # neckline
    o.append('<path class="ln" d="M221 276 Q250 284 279 276"/>')            # waist seam
    for x0, x1 in ((236, 222), (250, 250), (264, 280), (243, 196), (257, 304)):
        o.append(f'<path class="ln2" d="M{x0} 282 L{x1} 436"/>')
    o.append('<path class="ln" d="M250 437 L250 462"/><ellipse class="ln" cx="250" cy="466" rx="42" ry="6"/>')
    # RAHUL: male form with a blazer over a shirt, cx 540
    o.append('<ellipse class="ln" cx="540" cy="146" rx="12" ry="3.5"/>')
    o.append('<path class="ln" d="M528 146 L529 164 M552 146 L551 164"/>')
    jacket = ('M529 164 C510 166 496 170 488 180 C482 190 484 214 487 236 C490 262 492 300 494 336 '
              'L586 336 C588 300 590 262 593 236 C596 214 598 190 592 180 C584 170 570 166 551 164 Z')
    o.append('<path class="fw" d="M500 336 L497 440 L535 440 L540 362 L545 440 L583 440 L580 336 Z"/>'
             '<path class="ln" d="M500 336 L497 440 L535 440 L540 362 L545 440 L583 440 L580 336"/>')
    o.append(f'<path class="fw" d="{jacket}"/><path class="ln" d="{jacket}"/>')
    o.append('<path class="ln" d="M529 164 L540 186 L551 164"/>')            # shirt collar
    o.append('<path class="ln" d="M526 168 L512 214 L540 276 L568 214 L554 168"/>')  # lapels
    o.append('<path class="fp" d="M532 176 L540 270 L548 176 Z"/>')          # shirt front in tint
    o.append('<circle class="fi" cx="540" cy="292" r="2.6"/><circle class="fi" cx="540" cy="314" r="2.6"/>')
    o.append('<path class="ln" d="M563 236 L581 236"/><path class="fp" d="M565 236 L568 227 L572 232 L576 227 L579 236 Z"/><path class="lnp" d="M565 236 L568 227 L572 232 L576 227 L579 236"/>')  # pocket square
    o.append('<path class="ln2" d="M496 300 L514 300 M566 300 L584 300"/>')
    o.append('<path class="ln" d="M540 440 L540 462"/><ellipse class="ln" cx="540" cy="466" rx="42" ry="6"/>')
    # vanity mirror with bulbs between them
    o.append('<rect class="fw" x="352" y="168" width="96" height="128" rx="48"/><rect class="ln" x="352" y="168" width="96" height="128" rx="48"/>')
    o.append('<path class="ln2" d="M372 214 L392 194 M378 236 L414 200"/>')
    for (bx, by) in ((346, 190), (343, 230), (346, 270), (454, 190), (457, 230), (454, 270), (400, 158)):
        o.append(f'<circle class="fw" cx="{bx}" cy="{by}" r="5"/><circle class="ln2" cx="{bx}" cy="{by}" r="5"/>')
    # dresser with a phone, a watch and perfume
    o.append('<path class="ln" d="M342 312 L458 312 M350 312 L350 452 M450 312 L450 452 M350 360 L450 360"/>')
    o.append('<rect class="fw" x="364" y="290" width="16" height="22" rx="2"/><rect class="ln" x="364" y="290" width="16" height="22" rx="2"/><path class="ln" d="M368 290 L368 284 L376 284 L376 290"/>')
    o.append('<circle class="ln" cx="402" cy="304" r="7"/><path class="ln2" d="M392 304 L395 304 M409 304 L413 304"/>')
    o.append('<rect class="fi" x="420" y="294" width="16" height="18" rx="2"/>')
    # look tags
    o.append(_t(250, 530, f'{left.upper()} · LOOK 01', 14, anchor='middle', weight=500, ls=.16))
    o.append(_t(540, 530, f'{right.upper()} · LOOK 02', 14, anchor='middle', weight=500, ls=.16))
    o.append('</svg>')
    return ''.join(o)


def cart(menu, name='The Westside Coffee Cart', labels=True):
    """A striped-awning coffee cart with the W on its front and a standing menu board."""
    _t = globals()['_t'] if labels else _none
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a Westside coffee cart with a striped awning, '
         'two wheels, an espresso machine on the counter and a standing menu board">']
    o.append('<line class="ln2" x1="20" y1="476" x2="780" y2="476"/>')
    # awning
    top, edge = 118, 168
    o.append(f'<path class="fw" d="M196 {top} L604 {top} L622 {edge} L178 {edge} Z"/>')
    n = 12
    for i in range(n):
        x0 = 196 + i * (408 / n); x1 = x0 + 408 / n
        b0 = 178 + i * (444 / n); b1 = b0 + 444 / n
        if i % 2 == 0:
            o.append(f'<path class="fi" d="M{x0:.1f} {top} L{x1:.1f} {top} L{b1:.1f} {edge} L{b0:.1f} {edge} Z"/>')
    o.append(f'<path class="ln" d="M196 {top} L604 {top} L622 {edge} L178 {edge} Z"/>')
    scal = ''.join(f' Q{178 + (i + .5) * 37:.1f} {edge + 16} {178 + (i + 1) * 37:.1f} {edge}' for i in range(12))
    o.append(f'<path class="fw" d="M178 {edge}{scal} Z"/><path class="ln" d="M178 {edge}{scal}"/>')
    o.append(f'<path class="ln" d="M200 {edge + 8} L200 262 M600 {edge + 8} L600 262"/>')
    # hanging name board
    o.append('<path class="ln2" d="M330 182 L330 190 M470 182 L470 190"/>')
    o.append('<rect class="fw" x="290" y="190" width="220" height="26"/><rect class="ln" x="290" y="190" width="220" height="26"/>')
    o.append(_t(400, 208, name.upper(), 11, anchor='middle', weight=500, ls=.16))
    # counter and body
    o.append('<rect class="fi" x="176" y="262" width="448" height="10"/>')
    o.append('<rect class="fw" x="190" y="272" width="420" height="150"/><rect class="ln" x="190" y="272" width="420" height="150"/>')
    o.append('<rect class="ln2" x="204" y="286" width="190" height="122"/><rect class="ln2" x="406" y="286" width="190" height="122"/>')
    o.append('<use href="#logo-w" x="264" y="300" width="70" height="56" class="fi"/>')
    o.append(_t(299, 392, 'W E S T S I D E', 10, anchor='middle', weight=500, ls=.12))
    o.append(_t(501, 336, 'Coffee, and the look', 13, 'tx-d', anchor='middle', italic=True))
    o.append(_t(501, 356, 'that goes with it.', 13, 'tx-d', anchor='middle', italic=True))
    o.append(_t(501, 386, 'SHOW YOUR CUP IN STORE', 10, anchor='middle', weight=500, ls=.16, fill='var(--ink-3)'))
    # espresso machine, cups, jar on the counter
    o.append('<rect class="fw" x="440" y="226" width="92" height="36" rx="3"/><rect class="ln" x="440" y="226" width="92" height="36" rx="3"/>')
    o.append('<path class="ln" d="M458 262 L458 254 L468 254 L468 262 M504 262 L504 254 L514 254 L514 262"/><circle class="ln2" cx="486" cy="240" r="7"/>')
    for i, x in enumerate((232, 252, 272)):
        o.append(f'<path class="fw" d="M{x} {262 - 18} L{x + 14} {262 - 18} L{x + 12} 262 L{x + 2} 262 Z"/><path class="ln" d="M{x} {262 - 18} L{x + 14} {262 - 18} L{x + 12} 262 L{x + 2} 262 Z"/>')
    o.append('<path class="lnp" d="M253 252 L264 252"/>')
    o.append('<rect class="fw" x="560" y="236" width="26" height="26" rx="4"/><rect class="ln" x="560" y="236" width="26" height="26" rx="4"/><path class="ln2" d="M560 244 L586 244"/>')
    # wheels and handle
    for cx in (262, 538):
        o.append(f'<circle class="fw" cx="{cx}" cy="440" r="34"/><circle class="ln" cx="{cx}" cy="440" r="34"/><circle class="ln" cx="{cx}" cy="440" r="4"/>')
        for k in range(8):
            a = math.radians(k * 45)
            o.append(f'<line class="ln2" x1="{cx}" y1="440" x2="{cx + 30 * math.cos(a):.1f}" y2="{440 + 30 * math.sin(a):.1f}"/>')
    o.append('<path class="ln" d="M610 300 L668 286 L672 292"/>')
    # standing menu board
    o.append('<path class="ln" d="M22 474 L44 222 L166 222 L172 474"/>')
    o.append('<rect class="fi" x="40" y="234" width="124" height="214"/>')
    o.append(_t(102, 260, 'MENU', 10, anchor='middle', weight=500, ls=.3, fill='var(--paper)'))
    if not labels:  # rules where the menu lines go, for small sizes
        o.append(''.join(f'<path d="M54 {y} L{150 - (k % 3) * 18} {y}" style="fill:none;stroke:var(--paper);stroke-width:3;opacity:.7"/>' for k, y in enumerate(range(292, 432, 26))))
    y = 288
    for item, price in menu:
        o.append(_t(48, y, item, 10.5, fill='var(--paper)'))
        y += 26
    o.append('</svg>')
    return ''.join(o)


def rail(highlight='blazer', code='LOOK 014', labels=True):
    """A styling rail with six looks, one picked out, and a phone on a tripod with a ring light."""
    _t = globals()['_t'] if labels else _none
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a clothing rail with six outfits, one highlighted, '
         'and a phone on a tripod with a ring light, ready to film a look">']
    o.append('<line class="ln2" x1="20" y1="486" x2="780" y2="486"/>')
    o.append('<path class="ln" d="M92 470 L92 112 L552 112 L552 470 M72 470 L112 470 M532 470 L572 470"/>')
    for x in (78, 106, 538, 566):
        o.append(f'<circle class="ln" cx="{x}" cy="478" r="7"/>')
    looks = [
        ('shirt', 148), ('dress', 222), ('kurta', 296), ('blazer', 370), ('saree', 444), ('coord', 510)]
    for kind, cx in looks:
        o.append(f'<path class="ln" d="M{cx} 112 L{cx} 124 C{cx} 130 {cx + 8} 130 {cx + 8} 124"/>')
        o.append(f'<path class="ln" d="M{cx} 132 L{cx - 30} 150 M{cx} 132 L{cx + 30} 150"/>')
        hl = kind == highlight
        fill = 'fp' if hl else 'fw'
        if kind == 'shirt':
            d = f'M{cx - 30} 150 L{cx - 40} 210 L{cx - 30} 212 L{cx - 28} 280 L{cx + 28} 280 L{cx + 30} 212 L{cx + 40} 210 L{cx + 30} 150 Z'
            ex = f'<path class="ln2" d="M{cx} 150 L{cx} 280"/>'
        elif kind == 'dress':
            d = f'M{cx - 24} 150 C{cx - 26} 190 {cx - 18} 210 {cx - 20} 226 L{cx - 44} 380 L{cx + 44} 380 L{cx + 20} 226 C{cx + 18} 210 {cx + 26} 190 {cx + 24} 150 Z'
            ex = f'<path class="ln2" d="M{cx - 20} 226 L{cx + 20} 226"/>'
        elif kind == 'kurta':
            d = f'M{cx - 28} 150 L{cx - 38} 230 L{cx - 30} 232 L{cx - 32} 360 L{cx + 32} 360 L{cx + 30} 232 L{cx + 38} 230 L{cx + 28} 150 Z'
            ex = f'<path class="ln2" d="M{cx} 150 L{cx} 196 M{cx - 32} 330 L{cx + 32} 330"/>'
        elif kind == 'blazer':
            d = f'M{cx - 30} 150 L{cx - 36} 290 L{cx + 36} 290 L{cx + 30} 150 Z'
            ex = f'<path class="ln" d="M{cx - 10} 150 L{cx - 18} 196 L{cx} 238 L{cx + 18} 196 L{cx + 10} 150"/><circle class="fi" cx="{cx}" cy="252" r="2.2"/>'
        elif kind == 'saree':
            d = f'M{cx - 26} 150 L{cx - 30} 300 C{cx - 10} 330 {cx + 10} 330 {cx + 30} 300 L{cx + 26} 150 Z'
            ex = f'<path class="ln2" d="M{cx + 22} 150 C{cx + 10} 200 {cx - 22} 240 {cx - 28} 290 M{cx + 26} 170 C{cx + 14} 214 {cx - 14} 252 {cx - 22} 300"/>'
        else:
            d = f'M{cx - 26} 150 L{cx - 28} 226 L{cx + 28} 226 L{cx + 26} 150 Z M{cx - 26} 232 L{cx - 22} 360 L{cx - 2} 360 L{cx} 262 L{cx + 2} 360 L{cx + 22} 360 L{cx + 26} 232 Z'
            ex = ''
        o.append(f'<path class="{fill}" d="{d}"/><path class="ln" d="{d}"/>{ex}')
    hx = dict(looks)[highlight]
    o.append(_t(hx, 394, code, 16, anchor='middle', weight=500, ls=.14))
    o.append(f'<path class="lnp" d="M{hx} 402 L{hx} 418 L664 418"/>')
    # ring light and phone on tripod
    o.append('<circle class="ln2" cx="664" cy="250" r="66"/><circle class="ln" cx="664" cy="250" r="58"/>')
    o.append('<rect class="fw" x="640" y="204" width="48" height="92" rx="7"/><rect class="ln" x="640" y="204" width="48" height="92" rx="7"/>')
    o.append('<circle class="fi" cx="653" cy="216" r="3"/>')
    o.append(_t(659, 221, 'REC', 12, weight=500, ls=.1))
    o.append('<path class="ln" d="M664 296 L664 420 M664 420 L620 484 M664 420 L708 484 M664 420 L664 484"/>')
    o.append(_t(664, 522, 'filmed in store', 15, 'tx-d', anchor='middle', italic=True))
    o.append('</svg>')
    return ''.join(o)


def stores_grid(n=300, cols=25, picks=None):
    """n small windows in a grid; picks = {index: label} get a filled square and a leader line to a label."""
    picks = picks or {}
    cell, gap = 22, 6
    rows = -(-n // cols)
    w = cols * (cell + gap) - gap
    h = rows * (cell + gap) - gap
    o = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{n} squares, one for each store window, with some stories marked">']
    for i in range(n):
        r, c = divmod(i, cols)
        x, y = c * (cell + gap), r * (cell + gap)
        if i in picks:
            o.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" style="fill:var(--plan)"/>')
        else:
            o.append(f'<rect x="{x + .5}" y="{y + .5}" width="{cell - 1}" height="{cell - 1}" style="fill:none;stroke:var(--ink-3)"/>')
    o.append('</svg>')
    return ''.join(o)
