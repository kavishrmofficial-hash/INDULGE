"""Line-art illustrations for The Park deck, drawn in SVG. Colours come from the deck's CSS classes: ln (ink line), ln2 (fine
grey line), fp (light grey fill), fi (ink fill), fw (paper fill), fa (the orange accent), fpanel (panel fill); tx-d is the
uppercase sans, tx-m the mono for small labels, tx-n the sans for numbers, dcap a drawing's caption (hidden on phones, where the
overlay names the drawing). Nothing is drawn smaller than it can be read: the smallest type is 16 units in the phones."""
import math
from html import escape as esc
from kit import PILLAR


def _t(x, y, s, size=12, cls='', anchor='start', weight=400, ls=0, fill=None):
    st = f'font-size:{size}px;font-weight:{weight}' + (f';letter-spacing:{ls}em' if ls else '') + (f';fill:{fill}' if fill else '')
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="{cls}" style="{st}">{esc(s)}</text>'


def _panel(o):
    o.append('<rect class="fpanel" x="40" y="40" width="720" height="460"/>')
    o.append('<rect class="ln" x="40" y="40" width="720" height="460"/>')


def stage():
    """Someplace Else: a small stage, a mic, an amp and a guitar, string lights, a crowd, a phone filming one take."""
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a small pub stage with a microphone, an amplifier and a guitar '
         'under string lights, a crowd in front and a phone on a tripod filming the set in one take">']
    _panel(o)
    # string lights
    o.append('<path class="ln2" d="M52 86 Q400 150 748 86"/>')
    for i in range(1, 16):
        t = i / 16
        x = 52 + 696 * t
        y = (1 - t) ** 2 * 86 + 2 * (1 - t) * t * 150 + t ** 2 * 86
        o.append(f'<line class="ln2" x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{y + 9:.1f}"/>')
        o.append(f'<circle class="{"fp" if i % 3 else "fw"}" cx="{x:.1f}" cy="{y + 14:.1f}" r="5"/><circle class="ln2" cx="{x:.1f}" cy="{y + 14:.1f}" r="5"/>')
    # the sign
    o.append('<rect class="fw" x="276" y="150" width="248" height="46"/><rect class="ln" x="276" y="150" width="248" height="46"/>')
    o.append(_t(400, 180, 'SOMEPLACE ELSE', 19, 'tx-d', anchor='middle', ls=.16))
    # stage
    o.append('<path class="ln" d="M110 392 L690 392 L690 414 L110 414 Z"/>')
    o.append('<line class="ln2" x1="110" y1="400" x2="690" y2="400"/>')
    # amp
    o.append('<rect class="fw" x="168" y="300" width="96" height="92"/><rect class="ln" x="168" y="300" width="96" height="92"/>')
    o.append('<rect class="ln2" x="178" y="324" width="76" height="58"/>')
    for k in range(4):
        o.append(f'<circle class="ln2" cx="{186 + k * 14}" cy="312" r="3.4"/>')
    # mic and stand
    o.append('<path class="ln" d="M400 392 L400 252 M384 392 L416 392"/>')
    o.append('<path class="ln" d="M400 252 L428 232"/>')
    o.append('<ellipse class="fp" cx="434" cy="226" rx="8" ry="12" transform="rotate(-35 434 226)"/>')
    o.append('<ellipse class="ln" cx="434" cy="226" rx="8" ry="12" transform="rotate(-35 434 226)"/>')
    # stool
    o.append('<ellipse class="ln" cx="486" cy="330" rx="24" ry="6"/><path class="ln" d="M468 334 L460 392 M504 334 L512 392 M486 336 L486 392 M466 366 L506 366"/>')
    # guitar on its stand
    o.append('<path class="ln" d="M600 392 L612 352 M636 392 L624 352"/>')
    o.append('<path class="fp" d="M618 368 C596 368 590 346 600 334 C592 322 596 300 618 300 C640 300 644 322 636 334 C646 346 640 368 618 368 Z"/>')
    o.append('<path class="ln" d="M618 368 C596 368 590 346 600 334 C592 322 596 300 618 300 C640 300 644 322 636 334 C646 346 640 368 618 368 Z"/>')
    o.append('<circle class="ln2" cx="618" cy="334" r="8"/>')
    o.append('<path class="ln" d="M615 300 L615 214 L621 214 L621 300 M612 214 L612 196 L624 196 L624 214"/>')
    # crowd
    for k, cx in enumerate(range(96, 720, 52)):
        cy = 444 + (6 if k % 2 else 0)
        o.append(f'<circle class="fw" cx="{cx}" cy="{cy}" r="15"/><circle class="ln2" cx="{cx}" cy="{cy}" r="15"/>')
        o.append(f'<path class="ln2" d="M{cx - 22} {cy + 44} C{cx - 20} {cy + 20} {cx + 20} {cy + 20} {cx + 22} {cy + 44}"/>')
    # phone on a tripod, filming
    o.append('<rect class="fw" x="700" y="296" width="40" height="72" rx="6"/><rect class="ln" x="700" y="296" width="40" height="72" rx="6"/>')
    o.append('<circle class="fa" cx="710" cy="308" r="3"/>')
    o.append('<path class="ln" d="M720 368 L720 430 M720 430 L700 488 M720 430 L740 488"/>')
    o.append(_t(400, 530, 'one take, filmed live', 15, 'tx-d dcap', anchor='middle'))
    o.append('</svg>')
    return ''.join(o)


def suite():
    """Room 1967: a suite in one-point perspective, a pendant, a bed, a lounge chair, art, a door with its number."""
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a hotel suite in perspective with a low bed, a pendant lamp, '
         'a lounge chair, two framed artworks and a door marked 1967">']
    _panel(o)
    # the room: back wall and the four edges to the corners
    o.append('<rect class="ln" x="230" y="128" width="340" height="236"/>')
    o.append('<path class="ln2" d="M40 40 L230 128 M760 40 L570 128 M40 500 L230 364 M760 500 L716 468.5 M600 385.5 L570 364"/>')
    # art on the back wall
    o.append('<rect class="fw" x="262" y="160" width="70" height="92"/><rect class="ln" x="262" y="160" width="70" height="92"/>')
    o.append('<circle class="fp" cx="297" cy="206" r="22"/><circle class="ln2" cx="297" cy="206" r="22"/>')
    o.append('<rect class="fw" x="350" y="176" width="54" height="54"/><rect class="ln" x="350" y="176" width="54" height="54"/>')
    o.append('<path class="ln2" d="M356 222 L377 186 L398 222 Z"/>')
    # pendant
    o.append('<path class="ln" d="M470 40 L470 150"/>')
    o.append('<path class="fp" d="M444 176 C444 158 456 150 470 150 C484 150 496 158 496 176 Z"/><path class="ln" d="M444 176 C444 158 456 150 470 150 C484 150 496 158 496 176 Z"/>')
    # bed: headboard on the back wall, mattress coming forward
    o.append('<rect class="fw" x="300" y="262" width="200" height="56"/><rect class="ln" x="300" y="262" width="200" height="56"/>')
    o.append('<path class="fw" d="M292 318 L508 318 L566 430 L234 430 Z"/><path class="ln" d="M292 318 L508 318 L566 430 L234 430 Z"/>')
    o.append('<path class="ln" d="M234 430 L234 444 L566 444 L566 430"/>')
    o.append('<path class="fp" d="M312 324 L392 324 L396 346 L304 346 Z"/><path class="ln2" d="M312 324 L392 324 L396 346 L304 346 Z"/>')
    o.append('<path class="fp" d="M408 324 L488 324 L496 346 L404 346 Z"/><path class="ln2" d="M408 324 L488 324 L496 346 L404 346 Z"/>')
    o.append('<path class="ln2" d="M276 372 L524 372"/>')
    # lounge chair, front right
    o.append('<path class="fp" d="M610 402 C600 352 622 318 664 312 C700 308 716 330 712 360 L700 402 Z"/>')
    o.append('<path class="ln" d="M610 402 C600 352 622 318 664 312 C700 308 716 330 712 360 L700 402 Z"/>')
    o.append('<path class="fw" d="M604 402 L708 402 L700 420 L612 420 Z"/>')
    o.append('<path class="ln" d="M604 402 L708 402 L700 420 L612 420 Z M620 420 L612 470 M692 420 L700 470"/>')
    # door on the left wall, and its number
    o.append('<path class="fw" d="M112 172 L176 186 L176 380 L112 412 Z"/><path class="ln" d="M112 172 L176 186 L176 380 L112 412 Z"/>')
    o.append('<circle class="fi" cx="166" cy="292" r="2.6"/>')
    o.append(_t(136, 160, '1967', 24, 'tx-n', anchor='middle'))
    o.append(_t(400, 530, 'one suite, a new designer every year', 15, 'tx-d dcap', anchor='middle'))
    o.append('</svg>')
    return ''.join(o)


def cup():
    """Flurys 100: a cup of tea on its saucer, steam, and a ribboned pastry box marked 100."""
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a cup of tea on a saucer with steam rising, '
         'beside a ribboned pastry box marked Flurys 100">']
    _panel(o)
    o.append('<line class="ln2" x1="60" y1="440" x2="740" y2="440"/>')
    # saucer and cup
    o.append('<ellipse class="fw" cx="290" cy="410" rx="160" ry="30"/><ellipse class="ln" cx="290" cy="410" rx="160" ry="30"/>')
    o.append('<ellipse class="ln2" cx="290" cy="406" rx="96" ry="16"/>')
    o.append('<path class="fw" d="M196 292 C200 372 246 404 290 404 C334 404 380 372 384 292 Z"/>')
    o.append('<path class="ln" d="M196 292 C200 372 246 404 290 404 C334 404 380 372 384 292"/>')
    o.append('<ellipse class="fp" cx="290" cy="292" rx="94" ry="18"/><ellipse class="ln" cx="290" cy="292" rx="94" ry="18"/>')
    o.append('<path class="ln" d="M382 316 C430 308 432 372 370 366"/>')
    for k, x in enumerate((258, 290, 322)):
        o.append(f'<path class="ln2" d="M{x} 262 C{x - 14} 238 {x + 14} 222 {x} 196 C{x - 12} 178 {x + 10} 160 {x} 140"/>')
    # pastry box, resting on the table line
    o.append('<g transform="translate(0 10)">')
    o.append('<path class="fw" d="M486 300 L700 300 L700 430 L486 430 Z"/><path class="ln" d="M486 300 L700 300 L700 430 L486 430 Z"/>')
    o.append('<path class="fw" d="M486 300 L520 262 L734 262 L700 300 Z"/><path class="ln" d="M486 300 L520 262 L734 262 L700 300 Z"/>')
    o.append('<path class="fw" d="M700 300 L734 262 L734 392 L700 430 Z"/><path class="ln" d="M700 300 L734 262 L734 392 L700 430 Z"/>')
    o.append('<path class="ln2" d="M593 300 L593 430 M503 281 L717 281"/>')
    o.append('<path class="ln" d="M593 281 C570 250 548 258 560 276 C566 284 582 284 593 281 C604 278 620 270 626 258 C632 244 612 246 593 281"/>')
    o.append(_t(540, 352, 'FLURYS', 18, 'tx-d', anchor='middle', ls=.16))
    o.append(_t(646, 368, '100', 40, 'tx-n', anchor='middle'))
    o.append('</g>')
    o.append(_t(400, 530, 'a hundred years in 2027', 15, 'tx-d dcap', anchor='middle'))
    o.append('</svg>')
    return ''.join(o)


def hotels_grid(today=42, target=87, cols=12):
    """One square per hotel: today's filled in ink, the ones still to open drawn as hairlines."""
    cell, gap = 22, 6
    rows = -(-target // cols)
    w = cols * (cell + gap) - gap
    h = rows * (cell + gap) - gap
    o = [f'<svg viewBox="-1 -1 {w + 2} {h + 2}" role="img" aria-label="{target} squares, one per hotel: {today} open today in black, '
         f'{target - today} to open by 2030 in outline">']
    for i in range(target):
        r, c = divmod(i, cols)
        x, y = c * (cell + gap), r * (cell + gap)
        if i < today:
            o.append(f'<rect class="fi" x="{x}" y="{y}" width="{cell}" height="{cell}"/>')
        else:
            o.append(f'<rect x="{x + .5}" y="{y + .5}" width="{cell - 1}" height="{cell - 1}" style="fill:none;stroke:var(--ink-3)"/>')
    o.append('</svg>')
    return ''.join(o)


def _phone(o, x, y, screen, w=200, h=356):
    """A phone outline with its screen (fi night, fp bone, fw paper) and the speaker slot."""
    o.append(f'<rect class="fw" x="{x}" y="{y}" width="{w}" height="{h}" rx="22"/><rect class="ln" x="{x}" y="{y}" width="{w}" height="{h}" rx="22"/>')
    o.append(f'<rect class="{screen}" x="{x + 9}" y="{y + 9}" width="{w - 18}" height="{h - 18}" rx="15"/>')
    o.append(f'<rect class="{"fw" if screen == "fi" else "fi"}" x="{x + w / 2 - 22}" y="{y + 17}" width="44" height="7" rx="3.5"/>')


def _play(o, cx, cy, r=30, light=True):
    col = 'var(--paper)' if light else 'var(--ink)'
    o.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" style="fill:none;stroke:{col};stroke-width:1.3"/>')
    o.append(f'<path d="M{cx - r * .3:.1f} {cy - r * .53:.1f} L{cx + r * .5:.1f} {cy} L{cx - r * .3:.1f} {cy + r * .53:.1f} Z" style="fill:{col}"/>')


def _bars(o, x):
    for k in range(3):
        o.append(f'<line class="{"ln" if k == 0 else "ln2"}" x1="{x + 20 + k * 56}" y1="48" x2="{x + 68 + k * 56}" y2="48"/>')


def _dots(o, cx, y=334):
    for k in range(3):
        o.append(f'<circle class="{"fi" if k == 0 else "ln2"}" cx="{cx - 12 + k * 12}" cy="{y}" r="3"/>')


def _labels(o, labs):
    for x, lab in zip((110, 360, 610), labs):
        o.append(_t(x, 408, lab.upper(), 24, 'tx-m', anchor='middle', fill='rgba(18,18,18,.6)'))


def phones():
    """Three sample posts for The Sessions, drawn as phones: a Reel cover, a story and a carousel card."""
    o = ['<svg viewBox="0 0 720 420" role="img" aria-label="Line drawing: three phones showing sample posts for The Sessions. '
         'A Reel cover reading Park Street still plays, a story reading 11:40 p.m. Someplace Else, and a carousel card '
         'reading the full set on YouTube">']
    for x, sc in zip((10, 260, 510), ('fi', 'fp', 'fw')):
        _phone(o, x, 10, sc)
    _play(o, 110, 188)
    o.append(_t(110, 290, 'PARK STREET', 25, 'tx-d', anchor='middle', ls=.02, fill='var(--paper)'))
    o.append(_t(110, 320, 'STILL PLAYS', 25, 'tx-d', anchor='middle', ls=.02, fill='var(--paper)'))
    _bars(o, 260)
    o.append(_t(360, 178, '11:40', 62, 'tx-n', anchor='middle'))
    o.append(_t(360, 208, 'P.M. TONIGHT', 16, 'tx-m', anchor='middle'))
    o.append('<line class="ln2" x1="300" y1="236" x2="420" y2="236"/>')
    o.append(_t(360, 266, 'SOMEPLACE ELSE', 16, 'tx-d', anchor='middle', ls=.12))
    o.append('<rect class="fp" x="530" y="60" width="160" height="90"/><rect class="ln" x="530" y="60" width="160" height="90"/>')
    o.append('<circle class="fw" cx="610" cy="105" r="17"/><circle class="ln" cx="610" cy="105" r="17"/><path class="fi" d="M604 95 L620 105 L604 115 Z"/>')
    o.append(_t(610, 210, 'THE FULL SET', 21, 'tx-d', anchor='middle', ls=.04))
    o.append(_t(610, 238, 'ON YOUTUBE', 21, 'tx-d', anchor='middle', ls=.04))
    _dots(o, 610)
    _labels(o, ('Reel', 'Story', 'Carousel'))
    o.append('</svg>')
    return ''.join(o)


def room_posts():
    """Three sample posts for Room 1967: the Reel from day one, the waiting-list story, the designer carousel."""
    o = ['<svg viewBox="0 0 720 420" role="img" aria-label="Line drawing: three phones showing sample posts for Room 1967. '
         'A Reel cover reading Room 1967, the empty suite; a story reading 1967, the waiting list opens tonight; and a carousel '
         'card reading meet the designer">']
    for x, sc in zip((10, 260, 510), ('fi', 'fp', 'fw')):
        _phone(o, x, 10, sc)
    _play(o, 110, 178)
    o.append(_t(110, 286, 'ROOM 1967', 25, 'tx-d', anchor='middle', ls=.02, fill='var(--paper)'))
    o.append(_t(110, 316, 'THE EMPTY SUITE', 16, 'tx-m', anchor='middle', fill='var(--paper)'))
    _bars(o, 260)
    o.append(_t(360, 186, '1967', 64, 'tx-n', anchor='middle'))
    o.append(_t(360, 226, 'THE WAITING LIST', 16, 'tx-m', anchor='middle'))
    o.append(_t(360, 250, 'OPENS TONIGHT', 16, 'tx-m', anchor='middle'))
    o.append('<rect class="fp" x="530" y="60" width="160" height="110"/><rect class="ln" x="530" y="60" width="160" height="110"/>')
    o.append('<path class="ln" d="M574 150 C566 112 584 90 612 88 C636 86 648 102 644 124 L636 150 Z M572 150 L646 150 M584 150 L578 164 M634 150 L640 164"/>')
    o.append(_t(610, 218, 'MEET THE', 21, 'tx-d', anchor='middle', ls=.04))
    o.append(_t(610, 246, 'DESIGNER', 21, 'tx-d', anchor='middle', ls=.04))
    _dots(o, 610)
    _labels(o, ('Reel', 'Story', 'Carousel'))
    o.append('</svg>')
    return ''.join(o)


def flurys_posts():
    """Three sample posts for Flurys 100: a regular, a baker at 4 a.m., a recipe."""
    o = ['<svg viewBox="0 0 720 420" role="img" aria-label="Line drawing: three phones showing sample posts for Flurys 100. '
         'A Reel cover reading 001, same table every Sunday, a story reading 4:00 a.m. at the oven, Flurys, and a carousel card reading '
         'recipe number 01">']
    for x, sc in zip((10, 260, 510), ('fi', 'fp', 'fw')):
        _phone(o, x, 10, sc)
    _play(o, 110, 96, r=18)
    o.append(_t(110, 220, '001', 70, 'tx-n', anchor='middle', fill='var(--paper)'))
    o.append(_t(110, 296, 'SAME TABLE', 21, 'tx-d', anchor='middle', ls=.02, fill='var(--paper)'))
    o.append(_t(110, 322, 'EVERY SUNDAY', 21, 'tx-d', anchor='middle', ls=.02, fill='var(--paper)'))
    _bars(o, 260)
    o.append(_t(360, 180, '4:00', 64, 'tx-n', anchor='middle'))
    o.append(_t(360, 212, 'A.M. AT THE OVEN', 16, 'tx-m', anchor='middle'))
    o.append('<line class="ln2" x1="300" y1="238" x2="420" y2="238"/>')
    o.append(_t(360, 268, 'FLURYS', 18, 'tx-d', anchor='middle', ls=.14))
    o.append('<ellipse class="fw" cx="610" cy="140" rx="54" ry="10"/><ellipse class="ln" cx="610" cy="140" rx="54" ry="10"/>')
    o.append('<path class="fw" d="M576 96 C578 124 594 136 610 136 C626 136 642 124 644 96 Z"/><path class="ln" d="M576 96 C578 124 594 136 610 136 C626 136 642 124 644 96"/>')
    o.append('<ellipse class="fp" cx="610" cy="96" rx="34" ry="7"/><ellipse class="ln" cx="610" cy="96" rx="34" ry="7"/><path class="ln" d="M643 104 C662 102 662 124 640 122"/>')
    o.append(_t(610, 218, 'RECIPE NO. 01', 21, 'tx-d', anchor='middle', ls=.04))
    _dots(o, 610)
    _labels(o, ('Reel', 'Story', 'Carousel'))
    o.append('</svg>')
    return ''.join(o)


def reel_frame(k):
    """One frame of Set 01, the Reel, for the second-by-second page: k is 0 to 4."""
    names = ['the hook: 11:40 p.m., Park Street', 'the walk through the crowd', 'the chorus and the faces', 'the last note and the room',
             'the end card: the full set on YouTube']
    o = [f'<svg viewBox="0 0 220 376" role="img" aria-label="Line drawing of a phone showing the Reel at {names[k]}">']
    _phone(o, 10, 10, ('fi', 'fp', 'fw', 'fi', 'fw')[k], w=200, h=356)
    if k == 0:
        o.append(_t(110, 150, '11:40', 56, 'tx-n', anchor='middle', fill='var(--paper)'))
        o.append(_t(110, 180, 'P.M.', 16, 'tx-m', anchor='middle', fill='var(--paper)'))
        o.append(_t(110, 250, 'PARK STREET', 22, 'tx-d', anchor='middle', ls=.04, fill='var(--paper)'))
    elif k == 1:
        o.append('<path class="ln" d="M44 196 L176 196 M110 196 L110 120 M110 120 L126 108"/><ellipse class="fi" cx="130" cy="104" rx="5" ry="8" transform="rotate(-35 130 104)"/>')
        for j, cx in enumerate((50, 80, 110, 140, 170)):
            cy = 300 - (j % 2) * 12
            o.append(f'<circle class="fw" cx="{cx}" cy="{cy}" r="16"/><circle class="ln2" cx="{cx}" cy="{cy}" r="16"/>')
        o.append('<path class="ln2" d="M110 340 L110 236 M100 248 L110 236 L120 248"/>')
    elif k == 2:
        for j, cx in enumerate((50, 110, 170)):
            o.append(f'<circle class="fp" cx="{cx}" cy="210" r="22"/><circle class="ln" cx="{cx}" cy="210" r="22"/>')
            o.append(f'<path class="ln" d="M{cx - 14} 176 L{cx - 24} 120 M{cx + 14} 176 L{cx + 24} 124"/>')
            o.append(f'<path class="ln2" d="M{cx - 8} 216 C{cx - 4} 222 {cx + 4} 222 {cx + 8} 216"/>')
        o.append('<path class="ln2" d="M30 290 C70 270 150 270 190 290"/>')
    elif k == 3:
        o.append('<path d="M24 80 Q110 130 196 80" style="fill:none;stroke:var(--paper);stroke-width:1"/>')
        for j in range(1, 8):
            t = j / 8
            x = 24 + 172 * t
            y = (1 - t) ** 2 * 80 + 2 * (1 - t) * t * 130 + t ** 2 * 80
            o.append(f'<circle cx="{x:.1f}" cy="{y + 8:.1f}" r="4" style="fill:var(--paper)"/>')
        o.append('<path d="M50 230 L170 230 L170 244 L50 244 Z" style="fill:none;stroke:var(--paper);stroke-width:1.2"/>')
        for cx in (40, 70, 100, 130, 160, 190):
            o.append(f'<circle cx="{cx - 5}" cy="290" r="11" style="fill:none;stroke:var(--night-2);stroke-width:1"/>')
    else:
        _play(o, 110, 150, r=30, light=False)
        o.append(_t(110, 228, 'THE FULL SET', 19, 'tx-d', anchor='middle', ls=.04))
        o.append(_t(110, 252, 'ON YOUTUBE', 19, 'tx-d', anchor='middle', ls=.04))
        o.append('<rect class="ln" x="45" y="290" width="130" height="32" rx="16"/>')
        o.append(_t(110, 311, 'MESSAGE US', 12, anchor='middle', weight=500, ls=.14))
    o.append('</svg>')
    return ''.join(o)


def people(k):
    """Small line drawings for the community page: 0 artists, 1 regulars, 2 creators, 3 direct messages."""
    lab = ['a microphone and a guitar on a stand', 'a guest photo reposted with a credit line', 'a phone on a gimbal under string lights',
           'a direct message thread that ends with a confirmed table']
    o = [f'<svg viewBox="0 0 320 180" role="img" aria-label="Line drawing: {lab[k]}">']
    if k == 0:
        o.append('<path class="ln" d="M120 170 L120 70 M100 170 L140 170 M120 70 L144 54"/><ellipse class="fp" cx="150" cy="50" rx="8" ry="12" transform="rotate(-35 150 50)"/><ellipse class="ln" cx="150" cy="50" rx="8" ry="12" transform="rotate(-35 150 50)"/>')
        o.append('<path class="fp" d="M210 166 C190 166 184 146 192 134 C186 122 190 102 210 102 C230 102 234 122 228 134 C236 146 230 166 210 166 Z"/>')
        o.append('<path class="ln" d="M210 166 C190 166 184 146 192 134 C186 122 190 102 210 102 C230 102 234 122 228 134 C236 146 230 166 210 166 Z M207 102 L207 30 L213 30 L213 102 M204 30 L204 14 L216 14 L216 30"/><circle class="ln2" cx="210" cy="134" r="7"/>')
    elif k == 1:
        o.append('<rect class="fw" x="96" y="14" width="128" height="128"/><rect class="ln" x="96" y="14" width="128" height="128"/>')
        o.append('<rect class="fp" x="106" y="24" width="108" height="86"/><circle class="ln" cx="140" cy="76" r="14"/><circle class="ln" cx="178" cy="76" r="14"/><path class="ln2" d="M106 96 L214 96"/>')
        o.append(_t(160, 133, 'WITH CREDIT', 11, 'tx-m', anchor='middle', fill='rgba(18,18,18,.6)'))
        o.append('<path class="ln2" d="M236 60 C256 60 256 92 236 92 M244 52 L236 60 L244 68"/>')
    elif k == 2:
        o.append('<path class="ln2" d="M40 30 Q160 70 280 30"/>')
        for j in range(1, 8):
            t = j / 8
            x = 40 + 240 * t
            y = (1 - t) ** 2 * 30 + 2 * (1 - t) * t * 70 + t ** 2 * 30
            o.append(f'<circle class="fp" cx="{x:.1f}" cy="{y + 8:.1f}" r="5"/><circle class="ln2" cx="{x:.1f}" cy="{y + 8:.1f}" r="5"/>')
        o.append('<rect class="fw" x="140" y="70" width="40" height="70" rx="6"/><rect class="ln" x="140" y="70" width="40" height="70" rx="6"/><circle class="fi" cx="151" cy="82" r="3"/>')
        o.append('<path class="ln" d="M160 140 L160 172 M140 104 L126 104 L126 150 L160 150"/>')
    else:
        o.append('<rect class="fp" x="70" y="22" width="150" height="40" rx="20"/>')
        o.append(_t(145, 47, 'TABLE FOR TWO?', 12, anchor='middle', weight=500, ls=.1))
        o.append('<rect class="fi" x="110" y="80" width="150" height="40" rx="20"/>')
        o.append(_t(185, 105, '9 P.M., IT’S YOURS', 12, anchor='middle', weight=500, ls=.1, fill='var(--paper)'))
        o.append('<rect class="ln" x="70" y="138" width="110" height="32" rx="16"/>')
        o.append(_t(125, 159, 'SEE YOU THEN', 11, anchor='middle', weight=500, ls=.1))
    o.append('</svg>')
    return ''.join(o)


MAP = [  # pillar, what it covers, side, series (name, what you see, format, hero series?)
    ('After Hours', 'the night', 'left', [('The Sessions', 'One take at Someplace Else', 'Reel · YouTube · Spotify', True),
                                          ('The 3 a.m. Menu', 'The staff dinner after close', 'Reel', False),
                                          ('Who’s Playing', 'Tonight’s line-up, every Friday', 'Reel', False),
                                          ('Who Played', 'Last night’s set list', 'Carousel', False)]),
    ('By Design', 'the rooms', 'right', [('Room 1967', 'One suite, one designer a year', 'Reel · story · carousel', True),
                                        ('The Object', 'One design detail up close', 'Reel', False),
                                        ('The Architects', 'Who built each hotel', 'Carousel', False),
                                        ('Opening Night', 'A new hotel’s first night', 'Reel', False)]),
    ('The Table', 'the food', 'left', [('Flurys 100', 'A regular, a recipe, a baker', 'Reel · story · carousel', True),
                                       ('Chef’s Counter', 'One dish in thirty seconds', 'Reel', False),
                                       ('The Recipe', 'A dish to cook at home', 'Carousel', False)]),
    ('The City', 'the people', 'right', [('Night Shift', 'The people who work the night', 'Carousel', False),
                                         ('The Night Map', 'The city, by our staff', 'Carousel', False),
                                         ('The Night Off', 'A creator’s night at THE Park', 'Collab Reel', False),
                                         ('Ask the Concierge', 'Your DMs, answered', 'Reel', False)]),
]


def content_map():
    """The content plan as a mind map, drawn in the Hanza manner: the idea in an orange block in the middle, four pillars in
    blocks toned by the pillar code, fifteen series on square-cornered branches, each with what you see and its format; the
    three hero series carry an orange square."""
    # the viewBox has the map box's own ratio (about 2.69:1 at every 16:9 size), so the svg fills the box edge to edge and
    # its quarters are the column guides: the left pillars start on the second guide, the right ones end on the fourth
    W, H = 1950, 724.7
    cx, cy = W / 2, 345
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Mind map of the content plan. In the centre, the idea: Park Street, everywhere. '
         'Four pillars branch from it, and each pillar branches into its series: '
         + esc('; '.join(f'{p}: ' + ', '.join(f'{n} ({w})' for n, w, _, _ in s) for p, _, _, s in MAP)) + '">']
    spots = [(W * .25 + 120, 150), (W * .75 - 120, 150), (W * .25 + 120, 565), (W * .75 - 120, 565)]
    for (name, what, side, series), (px, py) in zip(MAP, spots):
        left = px < cx
        sx = cx + (-140 if left else 140)
        sy = cy + (-46 if py < cy else 46)
        ex = px + (120 if left else -120)
        kx = (sx + ex) / 2
        o.append(f'<path class="ln" style="stroke-width:1.4" d="M{sx} {sy} H{kx:.0f} V{py} H{ex}"/>')
        ox = px - 120 if left else px + 120
        dx = ox - 50 if left else ox + 50
        n = len(series)
        for k, (sname, see, fmt, hero) in enumerate(series):
            ly = py + (k - (n - 1) / 2) * 76
            bx = ox - 24 if left else ox + 24
            o.append(f'<path class="ln2" d="M{ox} {py} H{bx} V{ly:.0f} H{dx}"/>')
            z = 12 if hero else 9
            o.append(f'<rect class="{"fa" if hero else "fi"}" x="{dx - z / 2:.1f}" y="{ly - z / 2:.1f}" width="{z}" height="{z}"'
                     f'{"" if hero else ' style="opacity:.32"'}/>')
            tx, anchor = (dx - 18, 'end') if left else (dx + 18, 'start')
            o.append(_t(tx, f'{ly + 8:.0f}', sname.upper(), 23, 'tx-d', anchor=anchor))
            o.append(_t(tx, f'{ly + 31:.0f}', see, 18, anchor=anchor, fill='rgba(18,18,18,.6)'))
            o.append(_t(tx, f'{ly - 15:.0f}', fmt.upper(), 16, 'tx-m', anchor=anchor, fill='rgba(18,18,18,.6)'))
    tone = {
        'after': ('style="fill:var(--p-after)"', 'var(--paper)', 'rgba(255,255,255,.72)'),
        'design': ('style="fill:var(--p-design)"', 'var(--paper)', 'rgba(255,255,255,.76)'),
        'table': ('style="fill:var(--p-table)"', 'var(--paper)', 'rgba(255,255,255,.76)'),
        'city': ('style="fill:var(--p-city)"', 'var(--paper)', 'rgba(255,255,255,.76)'),
    }
    for (name, what, side, series), (px, py) in zip(MAP, spots):
        box, ink, sub = tone[PILLAR[name]]
        o.append(f'<rect {box} x="{px - 120}" y="{py - 38}" width="240" height="76"/>')
        o.append(_t(px, py + 2, name.upper(), 23, 'tx-d', anchor='middle', fill=ink))
        o.append(_t(px, py + 26, what.upper(), 16, 'tx-m', anchor='middle', fill=sub))
    o.append(f'<rect class="fa" x="{cx - 140}" y="{cy - 92}" width="280" height="184"/>')
    o.append(_t(cx - 116, cy - 60, 'THE IDEA', 16, 'tx-m'))
    o.append(_t(cx - 116, cy + 26, 'PARK STREET,', 31, 'tx-d', ls=-.02))
    o.append(_t(cx - 116, cy + 62, 'EVERYWHERE.', 31, 'tx-d', ls=-.02))
    o.append('</svg>')
    return ''.join(o)


HANDLES = [  # brand, voice, what it posts, how it runs
    ('THE Park', 'Seductive', 'Each hotel and its bars film the series', 'Someplace Else, Tantra, Agni, Aqua, Fire'),
    ('THE Park Collection', 'Unhurried', 'Ran Baas: slow films, palace weekends', 'One film a month, made to be watched'),
    ('Flurys', 'Nostalgic', 'A hundred stories for the centenary', '111 stores, and every new café'),
    ('Zone by The Park', 'Playful', 'Design at a fair price, second cities', 'Each opening starts with nine posts'),
    ('Zone Connect', 'Warm', 'Each town in its own language', 'Local creators and local festivals'),
    ('Stop by Zone', 'Direct', 'Price and place, said plainly', 'Stories and maps for the road'),
]


def handles_map():
    """The handles as a hub in the Hanza manner: the group feed in a black block, each brand in a white card with an orange
    rule, joined by square-cornered lines."""
    W, H, cx, cy = 1720, 700, 860, 350
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Mind map of the accounts. The group feed, @theparkhotels, sits in the middle. '
         'Around it: ' + esc('; '.join(f'{n}, {v}: {w}, {h}' for n, v, w, h in HANDLES)) + '">']
    spots = [(250, 94), (860, 94), (1470, 94), (250, 606), (860, 606), (1470, 606)]
    for (x, y) in spots:
        top = y < cy
        y0 = cy - 50 if top else cy + 50
        y1 = y + 70 if top else y - 70
        my = (y0 + y1) / 2
        o.append(f'<path class="ln2" d="M{cx} {y0} V{my:.0f} H{x} V{y1}"/>')
    o.append(_t(cx + 14, 278, 'THE BEST OF EACH HOTEL RUNS HERE', 16, 'tx-m', fill='rgba(18,18,18,.6)'))
    o.append(_t(cx + 14, 440, 'EACH NEW HOTEL GETS A LAUNCH KIT', 16, 'tx-m', fill='rgba(18,18,18,.6)'))
    for (name, voice, what, how), (x, y) in zip(HANDLES, spots):
        o.append(f'<rect class="fw" x="{x - 200}" y="{y - 70}" width="400" height="140"/>'
                 f'<rect class="ln2" x="{x - 200}" y="{y - 70}" width="400" height="140"/>'
                 f'<rect class="fa" x="{x - 200}" y="{y - 70}" width="400" height="2.1"/>')
        o.append(_t(x - 176, y - 30, name.upper(), 21, 'tx-d'))
        o.append(_t(x + 176, y - 30, voice.upper(), 16, 'tx-m', anchor='end', fill='rgba(18,18,18,.6)'))
        o.append(f'<line class="ln2" x1="{x - 176}" y1="{y - 12}" x2="{x + 176}" y2="{y - 12}"/>')
        o.append(_t(x - 176, y + 20, what, 18))
        o.append(_t(x - 176, y + 46, how, 16, fill='rgba(18,18,18,.6)'))
    o.append(f'<rect class="fi" x="{cx - 180}" y="{cy - 50}" width="360" height="100"/>')
    o.append(_t(cx, cy + 4, '@THEPARKHOTELS', 25, 'tx-d', anchor='middle', fill='var(--paper)'))
    o.append(_t(cx, cy + 30, 'THE GROUP FEED', 16, 'tx-m', anchor='middle', fill='rgba(255,255,255,.66)'))
    o.append('</svg>')
    return ''.join(o)
