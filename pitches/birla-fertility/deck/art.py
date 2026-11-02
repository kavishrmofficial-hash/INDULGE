"""Line drawings and maps for Mask360's proposal to Birla Fertility & IVF, in the Hanza look (deck.css). Colours come from the
deck's CSS classes: ln (ink line), ln2 (fine line), fp (pale pink fill), fi (ink fill), fw (paper fill), fa (the pink accent),
fpanel (panel fill); tx-d is the uppercase sans, tx-m the mono for small labels, tx-n the sans for numbers."""
from html import escape as esc

MUTE = 'var(--ink-2)'


def _t(x, y, s, size=12, cls='', anchor='start', weight=400, ls=0, fill=None):
    st = f'font-size:{size}px;font-weight:{weight}' + (f';letter-spacing:{ls}em' if ls else '') + (f';fill:{fill}' if fill else '')
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="{cls}" style="{st}">{esc(s)}</text>'


def _panel(o):
    o.append('<rect class="fpanel" x="40" y="40" width="720" height="460"/>')
    o.append('<rect class="ln" x="40" y="40" width="720" height="460"/>')


def night():
    """The 1 a.m. Questions: a bedroom at night, the lamp off, a clock at 1:04 and a phone with a question typed into it."""
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a bedroom at night with the moon in the window, a bedside '
         'table with a lamp switched off and a clock reading 1:04, and a phone with a fertility question typed into its search bar">']
    _panel(o)
    # window and moon
    o.append('<rect class="fw" x="470" y="78" width="210" height="150"/><rect class="ln" x="470" y="78" width="210" height="150"/>')
    o.append('<path class="ln2" d="M575 78 L575 228 M470 153 L680 153"/>')
    o.append('<circle class="fp" cx="630" cy="114" r="20"/><circle class="ln2" cx="630" cy="114" r="20"/>')
    # bed: pillow, mattress, blanket
    o.append('<path class="fw" d="M40 300 L360 300 L360 372 L40 372 Z"/><path class="ln" d="M40 300 L360 300 L360 372 L40 372"/>')
    o.append('<ellipse class="fw" cx="118" cy="290" rx="64" ry="18"/><ellipse class="ln2" cx="118" cy="290" rx="64" ry="18"/>')
    o.append('<path class="fp" d="M190 296 C240 284 300 286 360 298 L360 372 L200 372 Z"/>')
    o.append('<path class="ln2" d="M190 296 C240 284 300 286 360 298 M200 372 L190 296"/>')
    o.append('<path class="ln" d="M60 372 L60 420 M340 372 L340 420"/>')
    # bedside table, drawer and knob
    o.append('<rect class="fw" x="392" y="318" width="150" height="152"/><rect class="ln" x="392" y="318" width="150" height="152"/>')
    o.append('<line class="ln2" x1="392" y1="378" x2="542" y2="378"/><circle class="fi" cx="467" cy="350" r="2.6"/>')
    # lamp, switched off
    o.append('<ellipse class="ln" cx="428" cy="316" rx="18" ry="4"/><path class="ln" d="M428 312 L428 250"/>')
    o.append('<path class="fp" d="M400 250 L456 250 L444 212 L412 212 Z"/><path class="ln" d="M400 250 L456 250 L444 212 L412 212 Z"/>')
    # clock
    o.append('<rect class="fw" x="470" y="282" width="62" height="34"/><rect class="ln" x="470" y="282" width="62" height="34"/>')
    o.append(_t(501, 307, '1:04', 21, 'tx-n', anchor='middle'))
    # the phone and its question
    o.append('<rect class="fw" x="584" y="248" width="140" height="232" rx="16"/><rect class="ln" x="584" y="248" width="140" height="232" rx="16"/>')
    o.append('<rect class="fp" x="596" y="270" width="116" height="190" rx="4"/>')
    o.append('<rect class="fw" x="604" y="282" width="100" height="24" rx="12"/><rect class="ln2" x="604" y="282" width="100" height="24" rx="12"/>')
    o.append('<circle class="ln2" cx="616" cy="294" r="5"/>')
    for i, line in enumerate(('IS IT NORMAL', 'THAT IT’S', 'TAKING US', 'THIS LONG?')):
        o.append(_t(612, 334 + i * 22, line, 12, 'tx-d', ls=.08))
    o.append('<path class="ln" d="M612 422 L612 438"/>')
    o.append('<line class="ln2" x1="604" y1="450" x2="704" y2="450"/>')
    o.append('<line class="ln2" x1="40" y1="470" x2="760" y2="470"/>')
    o.append(_t(400, 530, 'a question typed at 1:04 a.m.', 15, 'tx-d', anchor='middle'))
    o.append('</svg>')
    return ''.join(o)


def _chair(o, x):
    """A side-view chair facing right, its seat at x to x+86."""
    o.append(f'<path class="ln" d="M{x} 360 L{x - 10} 238"/>')
    o.append(f'<rect class="fp" x="{x - 8}" y="248" width="14" height="96" transform="rotate(-5 {x} 296)"/>')
    o.append(f'<rect class="fp" x="{x}" y="350" width="86" height="14"/><rect class="ln" x="{x}" y="350" width="86" height="14"/>')
    o.append(f'<path class="ln" d="M{x + 6} 364 L{x} 450 M{x + 80} 364 L{x + 86} 450 M{x + 4} 410 L{x + 82} 410"/>')


def chairs():
    """Half the Story: a specialist's desk with two test folders, HERS and HIS, and two chairs facing it."""
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a fertility specialist’s desk with two test folders on it, '
         'one marked hers and one marked his, and two chairs side by side facing the desk">']
    _panel(o)
    # a framed print on the wall
    o.append('<rect class="fw" x="530" y="96" width="120" height="92"/><rect class="ln" x="530" y="96" width="120" height="92"/>')
    o.append('<circle class="ln2" cx="575" cy="142" r="24"/><circle class="ln2" cx="605" cy="142" r="24"/>')
    # desk
    o.append('<rect class="fw" x="440" y="292" width="300" height="16"/><rect class="ln" x="440" y="292" width="300" height="16"/>')
    o.append('<rect class="fw" x="456" y="308" width="268" height="142"/><rect class="ln" x="456" y="308" width="268" height="142"/>')
    o.append('<line class="ln2" x1="590" y1="308" x2="590" y2="450"/>')
    # the two folders
    for x, label in ((470, 'HERS'), (596, 'HIS')):
        o.append(f'<path class="fp" d="M{x} 292 L{x + 12} 262 L{x + 118} 262 L{x + 106} 292 Z"/>')
        o.append(f'<path class="ln" d="M{x} 292 L{x + 12} 262 L{x + 118} 262 L{x + 106} 292 Z"/>')
        o.append(_t(x + 59, 283, label, 13, 'tx-d', anchor='middle', ls=.2))
    # two chairs, side by side
    _chair(o, 150)
    _chair(o, 300)
    o.append('<line class="ln2" x1="40" y1="450" x2="760" y2="450"/>')
    o.append(_t(400, 530, 'two chairs, one appointment', 15, 'tx-d', anchor='middle'))
    o.append('</svg>')
    return ''.join(o)


def group():
    """The Good News Question: marigolds, two diyas, and a family chat where the question meets a sticker."""
    o = ['<svg viewBox="0 0 800 560" role="img" aria-label="Line drawing: a phone showing a family chat. An aunt asks good news kab, '
         'the reply is a sticker that says ask me about my trip to Goa, and she answers how was Goa. Marigold strings hang above '
         'and two diyas burn on either side">']
    _panel(o)
    # marigold strings
    for x in range(90, 740, 60):
        o.append(f'<line class="ln2" x1="{x}" y1="40" x2="{x}" y2="{70 + (x // 60 % 3) * 10}"/>')
        for k in range(3):
            o.append(f'<circle class="fp" cx="{x}" cy="{58 + k * 12 + (x // 60 % 3) * 10}" r="6"/>')
    # the phone
    o.append('<rect class="fw" x="292" y="104" width="216" height="372" rx="22"/><rect class="ln" x="292" y="104" width="216" height="372" rx="22"/>')
    o.append('<rect class="fp" x="304" y="124" width="192" height="40"/>')
    o.append(_t(400, 149, 'THE FAMILY GROUP', 12, 'tx-d', anchor='middle', ls=.16))
    # the question
    o.append('<rect class="fw" x="314" y="178" width="140" height="56" rx="10"/><rect class="ln2" x="314" y="178" width="140" height="56" rx="10"/>')
    o.append(_t(326, 198, 'MASI', 10, weight=500, ls=.12))
    o.append(_t(326, 222, 'good news kab?', 14))
    # the sticker
    o.append('<rect class="fp" x="350" y="250" width="140" height="104" rx="18"/><rect class="ln" x="350" y="250" width="140" height="104" rx="18"/>')
    for i, line in enumerate(('ASK ME ABOUT', 'MY TRIP', 'TO GOA')):
        o.append(_t(420, 286 + i * 24, line, 14, 'tx-d', anchor='middle', ls=.08))
    # the reply
    o.append('<rect class="fw" x="314" y="372" width="140" height="56" rx="10"/><rect class="ln2" x="314" y="372" width="140" height="56" rx="10"/>')
    o.append(_t(326, 392, 'MASI', 10, weight=500, ls=.12))
    o.append(_t(326, 416, 'how was Goa?', 14))
    # two diyas
    for cx in (160, 640):
        o.append(f'<path class="fp" d="M{cx - 54} 430 C{cx - 44} 466 {cx + 44} 466 {cx + 54} 430 Z"/>')
        o.append(f'<path class="ln" d="M{cx - 54} 430 C{cx - 44} 466 {cx + 44} 466 {cx + 54} 430 Z"/>')
        o.append(f'<path class="fw" d="M{cx} 384 C{cx + 12} 400 {cx + 12} 418 {cx} 424 C{cx - 12} 418 {cx - 12} 400 {cx} 384 Z"/>')
        o.append(f'<path class="ln" d="M{cx} 384 C{cx + 12} 400 {cx + 12} 418 {cx} 424 C{cx - 12} 418 {cx - 12} 400 {cx} 384 Z"/>')
    o.append('<line class="ln2" x1="40" y1="470" x2="760" y2="470"/>')
    o.append(_t(400, 530, 'a kinder way to change the subject', 15, 'tx-d', anchor='middle'))
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
        o.append(_t(x, 404, lab, 15, 'tx-d', anchor='middle'))


def _three(label, lines):
    return f'<svg viewBox="0 0 720 420" role="img" aria-label="Line drawing: three phones showing sample posts for {label}. {lines}">'


def asked_posts():
    """The 1 a.m. Questions as three posts: the Reel cover, the night story, the carousel to save."""
    o = [_three('The 1 a.m. Questions', 'A Reel cover asking is it normal that it is taking this long, a story at 1:04 a.m. with a '
                'question box, and a carousel card that says save this for later')]
    for x, sc in zip((10, 260, 510), ('fi', 'fp', 'fw')):
        _phone(o, x, 10, sc)
    o.append(_t(110, 92, 'QUESTION 01', 13, anchor='middle', weight=500, ls=.16, fill='var(--paper)'))
    _play(o, 110, 178)
    for i, w in enumerate(('IS IT NORMAL', 'IT’S TAKING', 'THIS LONG?')):
        o.append(_t(110, 268 + i * 28, w, 22, 'tx-d', anchor='middle', ls=.02, fill='var(--paper)'))
    _bars(o, 260)
    o.append(_t(360, 166, '1:04', 62, 'tx-n', anchor='middle'))
    o.append(_t(360, 194, 'A.M. TONIGHT', 13, anchor='middle', weight=500, ls=.16))
    o.append('<rect class="fw" x="292" y="222" width="136" height="70" rx="12"/><rect class="ln" x="292" y="222" width="136" height="70" rx="12"/>')
    o.append(_t(360, 246, 'ASK A SPECIALIST', 11, anchor='middle', weight=500, ls=.12))
    o.append('<line class="ln2" x1="306" y1="272" x2="414" y2="272"/>')
    o.append('<rect class="fa" x="530" y="60" width="160" height="90"/>')
    o.append(_t(610, 112, 'Q', 44, 'tx-n', anchor='middle'))
    o.append(_t(610, 210, 'SAVE THIS', 21, 'tx-d', anchor='middle', ls=.04))
    o.append(_t(610, 238, 'FOR LATER', 21, 'tx-d', anchor='middle', ls=.04))
    o.append(_t(610, 270, 'A SPECIALIST ANSWERS', 11, anchor='middle', weight=500, ls=.12, fill=MUTE))
    _dots(o, 610)
    _labels(o, ('Reel', 'Story', 'Carousel'))
    o.append('</svg>')
    return ''.join(o)


def half_posts():
    """Half the Story as three posts: the creator Reel, the Live notice, the first-test carousel."""
    o = [_three('Half the Story', 'A creator Reel titled part 01, can he get tested too, a story announcing a men-only Live on '
                'Thursday at 8 p.m., and a carousel card about the first test for him')]
    for x, sc in zip((10, 260, 510), ('fi', 'fp', 'fw')):
        _phone(o, x, 10, sc)
    o.append(_t(110, 92, 'PART 01', 13, anchor='middle', weight=500, ls=.16, fill='var(--paper)'))
    _play(o, 110, 178)
    for i, w in enumerate(('CAN HE GET', 'TESTED TOO?')):
        o.append(_t(110, 282 + i * 28, w, 22, 'tx-d', anchor='middle', ls=.02, fill='var(--paper)'))
    _bars(o, 260)
    o.append(_t(360, 150, 'LIVE', 46, 'tx-d', anchor='middle'))
    o.append(_t(360, 178, 'MEN ONLY', 13, anchor='middle', weight=500, ls=.16))
    o.append('<line class="ln2" x1="300" y1="206" x2="420" y2="206"/>')
    o.append(_t(360, 238, 'THURSDAY', 17, 'tx-d', anchor='middle', ls=.08))
    o.append(_t(360, 262, '8 P.M.', 17, 'tx-d', anchor='middle', ls=.08))
    o.append('<rect class="ln" x="300" y="284" width="120" height="30" rx="15"/>')
    o.append(_t(360, 304, 'REMIND ME', 11, anchor='middle', weight=500, ls=.14))
    o.append('<rect class="fp" x="530" y="60" width="160" height="90"/><rect class="ln" x="530" y="60" width="160" height="90"/>')
    o.append('<circle class="ln" cx="595" cy="105" r="18"/><circle class="ln" cx="625" cy="105" r="18"/>')
    o.append(_t(610, 210, 'HIS FIRST', 21, 'tx-d', anchor='middle', ls=.04))
    o.append(_t(610, 238, 'TEST', 21, 'tx-d', anchor='middle', ls=.04))
    o.append(_t(610, 270, 'WHAT TO EXPECT', 11, anchor='middle', weight=500, ls=.12, fill=MUTE))
    _dots(o, 610)
    _labels(o, ('Creator Reel', 'Story', 'Carousel'))
    o.append('</svg>')
    return ''.join(o)


def goodnews_posts():
    """The Good News Question as three posts: the sticker pack, the aunt film, the counsellor's Live."""
    o = [_three('The Good News Question', 'A sticker pack reading ask me about my trip, the new job and the wedding food, a short '
                'film titled Masi learns a new question, and a story for a counsellor-led Live')]
    for x, sc in zip((10, 260, 510), ('fp', 'fi', 'fw')):
        _phone(o, x, 10, sc)
    _bars(o, 10)
    o.append(_t(110, 92, 'ASK ME ABOUT…', 15, 'tx-d', anchor='middle', ls=.04))
    for i, (w, cls) in enumerate((('MY TRIP', 'fw'), ('THE NEW JOB', 'fa'), ('THE WEDDING FOOD', 'fw'))):
        y = 124 + i * 56
        o.append(f'<rect class="{cls}" x="34" y="{y}" width="152" height="38" rx="19"/><rect class="ln" x="34" y="{y}" width="152" height="38" rx="19"/>')
        o.append(_t(110, y + 24, w, 11, anchor='middle', weight=500, ls=.1))
    o.append(_t(360, 92, 'A SHORT FILM', 13, anchor='middle', weight=500, ls=.16, fill='var(--paper)'))
    _play(o, 360, 178)
    for i, w in enumerate(('MASI LEARNS', 'A NEW QUESTION')):
        o.append(_t(360, 282 + i * 28, w, 20, 'tx-d', anchor='middle', ls=.02, fill='var(--paper)'))
    o.append('<rect class="fp" x="530" y="60" width="160" height="90"/><rect class="ln" x="530" y="60" width="160" height="90"/>')
    o.append(_t(610, 112, 'LIVE', 30, 'tx-d', anchor='middle'))
    o.append(_t(610, 210, 'WORDS FOR', 21, 'tx-d', anchor='middle', ls=.04))
    o.append(_t(610, 238, 'THE WEDDING', 21, 'tx-d', anchor='middle', ls=.04))
    o.append(_t(610, 270, 'WITH A COUNSELLOR', 11, anchor='middle', weight=500, ls=.12, fill=MUTE))
    _dots(o, 610)
    _labels(o, ('Sticker pack', 'Film', 'Story'))
    o.append('</svg>')
    return ''.join(o)


def people(k):
    """Small line drawings for the voices page: 0 specialists, 1 counsellors, 2 men's health creators, 3 family creators."""
    lab = ['a camera on a tripod facing an empty chair by a sunlit window', 'a question box sticker and a reply from a counsellor',
           'a phone on a gimbal beside a dumbbell', 'a string of marigolds over a phone showing an ask me about sticker']
    o = [f'<svg viewBox="0 0 320 180" role="img" aria-label="Line drawing: {lab[k]}">']
    if k == 0:
        o.append('<rect class="fw" x="210" y="18" width="80" height="70"/><rect class="ln" x="210" y="18" width="80" height="70"/><path class="ln2" d="M250 18 V88 M210 53 H290"/>')
        o.append('<path class="ln2" d="M206 96 L170 140 M226 96 L214 150 M246 96 L256 152"/>')
        o.append('<path class="fp" d="M190 120 h44 v26 h-44 z"/><path class="ln" d="M190 120 h44 v26 h-44 z M194 120 L188 96 M230 120 L236 96 M196 146 V172 M228 146 V172"/>')
        o.append('<rect class="fi" x="70" y="62" width="58" height="36" rx="4"/><circle class="fw" cx="112" cy="80" r="9"/>')
        o.append('<path class="ln" d="M99 98 L99 120 M99 120 L74 172 M99 120 L124 172 M99 120 L99 172"/>')
    elif k == 1:
        o.append('<rect class="fp" x="60" y="18" width="160" height="78" rx="14"/><rect class="ln" x="60" y="18" width="160" height="78" rx="14"/>')
        o.append(_t(140, 46, 'ASK A COUNSELLOR', 11, anchor='middle', weight=500, ls=.1))
        o.append('<rect class="fw" x="76" y="58" width="128" height="24" rx="12"/><rect class="ln2" x="76" y="58" width="128" height="24" rx="12"/>')
        o.append('<rect class="fi" x="120" y="116" width="170" height="40" rx="20"/>')
        o.append(_t(205, 141, 'WE’RE HERE TILL 10 P.M.', 11, anchor='middle', weight=500, ls=.08, fill='var(--paper)'))
    elif k == 2:
        o.append('<rect class="fw" x="140" y="34" width="40" height="70" rx="6"/><rect class="ln" x="140" y="34" width="40" height="70" rx="6"/><circle class="fi" cx="151" cy="46" r="3"/>')
        o.append('<path class="ln" d="M160 104 L160 140 M140 70 L126 70 L126 116 L160 116 M144 172 L176 172 M160 140 L160 172"/>')
        o.append('<rect class="fi" x="214" y="132" width="10" height="34" rx="2"/><rect class="fi" x="262" y="132" width="10" height="34" rx="2"/>')
        o.append('<path class="ln" d="M224 149 L262 149"/><rect class="fp" x="226" y="140" width="34" height="18"/>')
    else:
        o.append('<path class="ln2" d="M30 22 Q160 60 290 22"/>')
        for j in range(1, 10):
            t = j / 10
            x = 30 + 260 * t
            y = (1 - t) ** 2 * 22 + 2 * (1 - t) * t * 60 + t ** 2 * 22
            o.append(f'<circle class="fa" cx="{x:.1f}" cy="{y + 9:.1f}" r="6"/>')
        o.append('<rect class="fw" x="128" y="62" width="64" height="110" rx="9"/><rect class="ln" x="128" y="62" width="64" height="110" rx="9"/>')
        o.append('<rect class="fp" x="136" y="96" width="48" height="40" rx="8"/>')
        o.append(_t(160, 113, 'ASK ME', 8, anchor='middle', weight=500, ls=.1))
        o.append(_t(160, 125, 'ABOUT…', 8, anchor='middle', weight=500, ls=.1))
    o.append('</svg>')
    return ''.join(o)


MAP = [  # pillar, what it covers, side, series (name, what you see, format, hero series?)
    ('Answer', 'the questions', 'left', [('The 1 a.m. Questions', 'A specialist answers one question', 'Reel · Short', True),
                                        ('Myth or Fact', 'A myth, checked by a specialist', 'Carousel', False),
                                        ('Ask a Specialist', 'Your questions, live, once a month', 'Instagram Live', False)]),
    ('The Science', 'the lab', 'right', [('Inside the Lab', 'An embryologist’s first hour', 'Reel · YouTube', False),
                                        ('Meet the Specialist', 'Who answers, and why', 'Reel · LinkedIn', False),
                                        ('Science, Simply', 'One idea in five minutes', 'YouTube', False)]),
    ('Reassure', 'the journey', 'left', [('Your First Visit', 'What happens, step by step', 'Carousel · Reel', False),
                                        ('The Counsellor’s Hour', 'A question box at night', 'Stories', False),
                                        ('A Cycle, Explained', 'Six frames, one cycle', 'Carousel', False)]),
    ('Belong', 'the people', 'right', [('Half the Story', 'Men’s fertility, for men', 'Creator series', True),
                                      ('The Good News Question', 'A kind way out', 'Stickers · film', True),
                                      ('Your Questions, Answered', 'Reels that reply to comments', 'Reel', False)]),
]


def content_map():
    """The content plan as a mind map in the Hanza manner: the idea in a pink block in the middle, four pillars in navy blocks,
    twelve series on square-cornered branches, each with what you see and its format; the three campaigns carry a pink square."""
    W, H, cx, cy = 1720, 740, 860, 355
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Mind map of the content plan. In the centre, the idea: No question too quiet. '
         'Four pillars branch from it, and each pillar branches into its series: '
         + esc('; '.join(f'{p}: ' + ', '.join(f'{n} ({w})' for n, w, _, _ in s) for p, _, _, s in MAP)) + '">']
    spots = [(500, 150), (1220, 150), (500, 560), (1220, 560)]
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
            ly = py + (k - (n - 1) / 2) * 92
            bx = ox - 24 if left else ox + 24
            o.append(f'<path class="ln2" d="M{ox} {py} H{bx} V{ly:.0f} H{dx}"/>')
            z = 12 if hero else 9
            o.append(f'<rect class="{"fa" if hero else "fi"}" x="{dx - z / 2:.1f}" y="{ly - z / 2:.1f}" width="{z}" height="{z}"'
                     + ('' if hero else ' style="opacity:.32"') + '/>')
            tx, anchor = (dx - 18, 'end') if left else (dx + 18, 'start')
            o.append(_t(tx, f'{ly + 8:.0f}', sname.upper(), 23, 'tx-d', anchor=anchor))
            o.append(_t(tx, f'{ly + 31:.0f}', see, 18, anchor=anchor, fill=MUTE))
            o.append(_t(tx, f'{ly - 15:.0f}', fmt.upper(), 14, 'tx-m', anchor=anchor, fill=MUTE))
    for (name, what, side, series), (px, py) in zip(MAP, spots):
        o.append(f'<rect class="fi" x="{px - 120}" y="{py - 38}" width="240" height="76"/>')
        o.append(_t(px, py + 4, name.upper(), 23, 'tx-d', anchor='middle', fill='var(--paper)'))
        o.append(_t(px, py + 26, what.upper(), 13, 'tx-m', anchor='middle', fill='rgba(255,255,255,.66)'))
    o.append(f'<rect class="fa" x="{cx - 140}" y="{cy - 92}" width="280" height="184"/>')
    o.append(_t(cx - 116, cy - 60, 'THE IDEA', 14, 'tx-m'))
    o.append(_t(cx - 116, cy + 26, 'NO QUESTION', 31, 'tx-d', ls=-.02))
    o.append(_t(cx - 116, cy + 62, 'TOO QUIET.', 31, 'tx-d', ls=-.02))
    o.append('</svg>')
    return ''.join(o)


HANDLES = [  # account, voice, what it posts, how it runs
    ('ARMC IVF', 'Warm', 'The series in Malayalam, for Kerala', 'Its own handle, Kerala and the Gulf'),
    ('YouTube', 'Patient', 'Answers people search for', '470+ videos, two long answers a month'),
    ('Facebook', 'Familiar', 'Reach beyond the metros', 'Hindi first, regional edits next'),
    ('LinkedIn', 'Expert', 'The science and the people', 'Specialists, research, careers'),
    ('WhatsApp', 'Kind', 'Cards made to forward', 'A weekly channel, and Fertility Circle'),
    ('Every centre', 'Local', 'Each series in the city’s language', '50+ centres, one voice book'),
]


def handles_map():
    """The accounts as a hub in the Hanza manner: the main feed in a navy block, each account in a white card with a pink rule,
    joined by square-cornered lines."""
    W, H, cx, cy = 1720, 700, 860, 350
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Map of the accounts. The main feed, @birlafertility, sits in the middle. '
         'Around it: ' + esc('; '.join(f'{n}, {v}: {w}, {h}' for n, v, w, h in HANDLES)) + '">']
    spots = [(250, 94), (860, 94), (1470, 94), (250, 606), (860, 606), (1470, 606)]
    for (x, y) in spots:
        top = y < cy
        y0 = cy - 50 if top else cy + 50
        y1 = y + 70 if top else y - 70
        my = (y0 + y1) / 2
        o.append(f'<path class="ln2" d="M{cx} {y0} V{my:.0f} H{x} V{y1}"/>')
    o.append(_t(cx + 14, 278, 'ONE VOICE BOOK FOR EVERY ACCOUNT', 14, 'tx-m', fill=MUTE))
    o.append(_t(cx + 14, 440, 'EACH CITY GETS ITS OWN LANGUAGE', 14, 'tx-m', fill=MUTE))
    for (name, voice, what, how), (x, y) in zip(HANDLES, spots):
        o.append(f'<rect class="fw" x="{x - 200}" y="{y - 70}" width="400" height="140"/>'
                 f'<rect class="ln2" x="{x - 200}" y="{y - 70}" width="400" height="140"/>'
                 f'<rect class="fa" x="{x - 200}" y="{y - 70}" width="400" height="3"/>')
        o.append(_t(x - 176, y - 30, name.upper(), 21, 'tx-d'))
        o.append(_t(x + 176, y - 30, voice.upper(), 14, 'tx-m', anchor='end', fill=MUTE))
        o.append(f'<line class="ln2" x1="{x - 176}" y1="{y - 12}" x2="{x + 176}" y2="{y - 12}"/>')
        o.append(_t(x - 176, y + 20, what, 18))
        o.append(_t(x - 176, y + 46, how, 16, fill=MUTE))
    o.append(f'<rect class="fi" x="{cx - 180}" y="{cy - 50}" width="360" height="100"/>')
    o.append(_t(cx, cy + 4, '@BIRLAFERTILITY', 25, 'tx-d', anchor='middle', fill='var(--paper)'))
    o.append(_t(cx, cy + 30, 'THE MAIN FEED', 13, 'tx-m', anchor='middle', fill='rgba(255,255,255,.66)'))
    o.append('</svg>')
    return ''.join(o)
