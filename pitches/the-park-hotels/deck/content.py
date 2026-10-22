"""Slide copy for Mask360's social media proposal to The Park Hotels, addressed to Anmol Tyagi, who posted the call for
agencies. Laid out in the Hanza look (deck.css): every slide uses a four-column layout, headings run in two tones, small
labels are mono. The content plan is drawn as mind maps (art.content_map, art.handles_map), and twenty reference clips
from other hotels' feeds play in place (media/, fetched by fetch_refs.py). Facts come from pitches/the-park-hotels/README.md;
Mask360's work comes from its own records. A cold pitch is conversation one, so there is no pricing and no team grid, and
it ends on an open door."""
import datetime as dt
from html import escape as esc
import json
import pathlib
import art
from kit import (slide, ul, table, tile, chapter, PILLAR, TAG, pillar_key, btn, lab, dots, hh, stat, video_card, roll, M_MARK, P_MARK, P_VIEW, WORDMARK)

TITLE = "M360 Park Hotel's pitch"
DESCRIPTION = ('Mask360’s social media proposal to The Park Hotels, October 2026: Park Street, everywhere. The content map, '
               'twenty reference clips, the feed, the handles and the numbers.')

# the slides in deck order; page references on the slides are looked up here
ORDER = ['cover', 'promise', 'brief', 'ch-today', 'today', 'channels', 'rule', 'insight', 'ch-idea', 'mindmap', 'ref-named',
         'ref-craft', 'ref-people', 'ref-rooms', 'mix', 'feed', 'voice', 'sessions', 'reel', 'room', 'flurys', 'ch-run', 'calendar',
         'handles', 'community', 'measure', 'mask360', 'faq', 'next', 'close', 'sources']

MEDIA = {v['slug']: v for v in json.loads((pathlib.Path(__file__).parent / 'media' / 'manifest.json').read_text())['files']}


def pg(sid):
    return f'{ORDER.index(sid) + 1:02d}'


# full sources, shown on the last page; each slide carries a short version
SOURCES = [
    ('The Park today', 'Apeejay Surrendra Park Hotels Q1 FY27 results, Aug 2026: revenue ₹166.8 crore, up 8.1%; occupancy 92%; RevPAR about '
     '₹6,858 (Investywise, ScanX). Food, beverage, nightlife and lifestyle dining about 43% of revenue: IDBI Capital result review, '
     '19 Aug 2026. Flurys 111 stores: Q1 FY27 investor presentation. 42 hotels in 32 cities: Business Traveller, October 2026. '
     '87 hotels by FY30, 45 under development: company investor material, Q1 FY27 and 2 Sep 2026 (Multibagg; filing to NSE).'),
    ('Channels', 'As linked from theparkhotels.com, October 2026: Instagram @theparkhotels, YouTube /theparkhotels, Facebook The Park '
     'Hotels, X @parkhotelsindia, LinkedIn The Park Hotels, Pinterest @theparkhotels. Spotify, WhatsApp and a monthly ChatGPT discovery '
     'audit are Mask360’s proposal. The ChatGPT audit reviews guest-facing answers and Park-owned information; model output remains outside our control.'),
    ('The brands', 'The Park Hotels corporate overview: five hotel brands, plus Flurys. Zone by The Park at launch: design-conscious and '
     'price-conscious (eHotelier). Ran Baas The Palace, Patiala: 35 suites, opened January 2025, Prix Versailles world’s most '
     'beautiful hotels 2025 (Robb Report India, Time Out).'),
    ('Park Street', 'The Park Kolkata opened in 1967 on Park Street, which gave the group its name (Hotel Designs, Entrepreneur India). '
     'Venues from THE Park Kolkata and THE Park New Delhi dining pages: Someplace Else, Tantra, Roxy, Agni, Aqua, Fire. THE Park '
     'Bangalore was designed by Terence Conran. “Anything but ordinary” has been the line since the 2013 rebrand (Travel Trends Today).'),
    ('The content', 'Flurys turns 100 in 2027 and opened a 24-hour café in Gurugram on 7 Aug 2026 (company announcement via Sahi). The '
     'Kolkata Christmas Festival on Park Street is co-organised by the Apeejay Surrendra Group (News Arena). Instagram’s profile '
     'grid shows posts at 3:4. Pillars, series, formats, cadence, sample posts, captions and the Reel are Mask360’s proposal.'),
    ('The references', 'Twenty clips from hotel and brand feeds, gathered by Mask360 for direction: The Savoy, Four Seasons (with The White '
     'Lotus), The Roseate, Bulgari, Rosewood, Amankila, Mama Shelter, Raffles Jaipur, The Hoxton with Lacoste, and five hotels whose '
     'names are not on screen. Brands are named only where the clip shows them. Mask360 did not make these clips.'),
    ('Mask360', 'Accounts, managed feeds and the Nexa Platinum Lounge result come from Mask360’s own records.'),
]


def cover():
    chapters = [(pg('ch-today'), 'The Park today', 'ch-today'), (pg('ch-idea'), 'Park Street, everywhere', 'ch-idea'),
                (pg('ref-named'), 'The references', 'ref-named'), (pg('ch-run'), 'How it runs', 'ch-run')]
    svc = ''.join(f'<li><span class="mn">/{n}</span><a href="#{i}">{roll(t)}</a></li>' for n, t, i in chapters)
    body = f'''<div class="top">{WORDMARK}<p class="mono clock"><b data-clock>Kolkata</b> <span class="k">Park Street time</span></p>{M_MARK}</div>
<div class="g4 grow" style="grid-template-rows:1fr auto auto;row-gap:calc(var(--u)*1.5)">
  <p class="lede-s c3 end pr" style="grid-row:2">A social media proposal from Mask360: <b>turn THE Park’s nights into a feed the city saves.</b></p>
  <ul class="svc c4 end" style="grid-row:2">{svc}</ul>
  <p class="who c12 end" style="grid-row:2">For <b>Anmol Tyagi</b> and the brand team<br>October 2026 · Confidential</p>
  <h1 class="h-display cover-h c14" style="grid-row:3"><span class="g">Park Street,</span> everywhere.</h1>
</div>'''
    return slide('cover', 'Proposal', body, src='', bare=True, dark=True, cls='cover')


def promise():
    terms = [('Found', 'Reels and search that bring the city in.'), ('Saved', 'Posts people keep for Friday night.'),
             ('Booked', 'Every post one tap from a table or a room.')]
    cards = ''.join(f'''<div class="card"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span></span>{dots(i + 1)}</div>
<p class="h3 mt-m">{t}</p><p class="ink2">{d}</p></div>''' for i, (t, d) in enumerate(terms))
    body = f'''<div class="g4 grow" style="grid-template-rows:auto 1fr auto">
  {lab('Our promise', pg('promise'), 'c1')}
  <h2 class="q q-l c14" style="grid-row:2;align-self:start;margin-top:calc(var(--u)*2.2)">We will make THE Park’s feed the city’s night out.</h2>
  <div class="c1 end pr" style="grid-row:3">{btn('See the map', pg('mindmap'), '#mindmap')}</div>
  <div class="c24 g4 g3 stagger" style="grid-row:3">{cards}</div>
</div>'''
    return slide('promise', 'Proposal · our promise', body)


def brief():
    rows = [('A social media agency', 'A content map, twenty references, a month on the feed and every handle.',
             f'{pg("mindmap")} · {pg("ref-named")} · {pg("calendar")} · {pg("handles")}'),
            ('Hospitality and luxury', 'THE Park in its own numbers, and the hotels we have worked with.', f'{pg("today")} · {pg("mask360")}'),
            ('Think beyond the obvious', 'We post what only THE Park can.', pg('rule')),
            ('Have the work to back it up', 'Feeds we run for The Penthouse at St. Regis Mumbai and Moxy Mumbai, and a lounge that sold 530 tickets at ₹75,000.', pg('mask360')),
            ('An upcoming pitch', 'This is our point of view, with quick answers. We bring the full plan to the pitch.', f'{pg("faq")} · {pg("next")}')]
    acc = ''.join(f'''<div{" class=open" if i == 0 else ""}><span class="mn">0{i + 1}</span><p class="q">{q}</p><span class="x"><span class="mute">P.</span> {p}</span>
<p class="a">{a}</p></div>''' for i, (q, a, p) in enumerate(rows))
    body = f'''<div class="g4 grow">
  <div class="c12 stack-l pr">{lab('Your brief', pg('brief'))}{hh('What you', 'asked for.', cls='h1')}
    <p class="lede-s" style="max-width:24em">Your call for agencies on LinkedIn, <b>answered page by page.</b></p></div>
  <div class="c34 acc end">{acc}</div>
</div>'''
    return slide('brief', 'Proposal · your brief', body, src='From your call for agencies on LinkedIn.')


def ch_today():
    return chapter('ch-today', '01', ('The Park', 'today.'), '92% full, 43% of revenue from food, drink and nightlife, six channels <b>and 45 hotels to come.</b>',
                   [(pg('today'), 'The numbers', 'today'), (pg('channels'), 'The channels', 'channels'),
                    (pg('rule'), 'The house rule', 'rule'), (pg('insight'), 'The insight', 'insight')])


def today():
    nums = [('92%', 'Occupancy', 'Q1 FY27 results.', 92, '92 of 100 rooms sold'),
            ('43%', 'Of revenue', 'From food, drink and nightlife: Q1 FY27.', 43, '43 of every 100 rupees'),
            ('42', 'Hotels today', 'In 32 cities, October 2026.', 42 / 87 * 100, '42 of 87 hotels by FY2030'),
            ('45', 'New hotels', 'Under development, for 87 hotels by FY2030.', 45 / 87 * 100, '45 of 87 still to open')]
    cells = ''.join(f'''<div class="card stat-card"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span>{k}</span></div>
<div class="big">{n}</div>
<div class="track" role="img" aria-label="{a}"><i style="width:{w:.0f}%"></i></div>
<p class="ink2">{d}</p></div>''' for i, (n, k, d, w, a) in enumerate(nums))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The numbers', pg('today'))}{hh('At 92% full,', 'the feed sells the nights.', cls='h1')}</div>
  <p class="lede-s c4 end">Nine rooms in ten are sold. <b>The feed’s job is the bars, the tables, direct bookings and the new hotels.</b></p>
</div>
<div class="g4 mt-auto cardrow">{cells}</div>'''
    return slide('today', 'The Park today · the numbers', body, src='Sources: Q1 FY27 results and investor material, 2026. Full list on the last page.')


CHANNELS = [  # channel, handle or status, its job, its cadence
    ('Instagram', '@theparkhotels', 'The magazine: Reels, carousels, stories', '4 Reels, 4 carousels, stories daily'),
    ('YouTube', '/theparkhotels', 'The Sessions in full, and Shorts', '1 set a month, 3 Shorts a week'),
    ('Spotify', 'new', 'The Sessions playlist', 'A new set each month'),
    ('WhatsApp', 'new', 'The concierge behind every post', 'Always on'),
    ('Facebook', 'The Park Hotels', 'Events and city listings', '3 posts a week'),
    ('LinkedIn', 'The Park Hotels', 'Openings, people and design', '2 posts a week'),
    ('Pinterest', '@theparkhotels', 'Rooms and design boards', '1 board a week'),
    ('X', '@parkhotelsindia', 'Tonight’s line-up', 'On event nights'),
    ('ChatGPT', 'audit', 'Audit answers to where to stay, eat and hear live music', 'Monthly audit; refresh Park-owned information'),
]


def channels():
    def name(c, h):
        tag = ('<span class="badge">New</span>' if h == 'new' else
               '<span class="badge audit">Monthly audit</span>' if h == 'audit' else f'<span class="mono mute">{h}</span>')
        return f'<b>{c}</b> {tag}'
    rows = [[name(c, h), j, w] for c, h, j, w in CHANNELS]
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The channels', pg('channels'))}{hh('Six channels today.', 'Three ways to grow discovery.', cls='h1')}</div>
  <p class="lede-s c4 end">Add Spotify and WhatsApp, plus a monthly ChatGPT audit: <b>what guests hear when they ask where to stay, eat and hear live music.</b> Refresh the Park’s owned information each month.</p>
</div>
<div class="mt-auto">{table(['Channel', 'Its job', 'Cadence'], rows, cls='tbl g4t tight stackable')}</div>'''
    return slide('channels', 'The Park today · channels', body, src='Channels as linked from theparkhotels.com, October 2026. Cadence is Mask360’s proposal.')


def rule():
    rows = [('Who played last night', 'Who Played', 'Every Monday'), ('What the kitchen cooks at 3 a.m.', 'The 3 a.m. Menu', 'Every Thursday'),
            ('The people on the night shift', 'Night Shift', 'Every Monday'), ('A room a designer made', 'Room 1967', 'One suite a year'),
            ('The city after dark', 'The Night Map', 'Every Saturday')]
    trs = [[a, f'<span class="sq"></span>&ensp;<b>{b}</b>', f'<span class="mono">{c}</span>'] for a, b, c in rows]
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The house rule', pg('rule'))}{hh('We post what', 'only THE Park can.', cls='h1')}</div>
  <p class="lede-s c4 end">“Anything but ordinary” has been the line since 2013. <b>On a feed, it means this.</b></p>
</div>
<div class="mt-auto">{table(['What only THE Park can post', 'The series it becomes', 'How often'], rows=trs, cls='tbl half stackable')}</div>'''
    return slide('rule', 'The Park today · the house rule', body, src='Series are Mask360’s proposal.')


def insight():
    cards = [('1967', 'The first hotel', 'The Park opens on Park Street, Calcutta.'),
             ('Jazz', 'The street', 'Cabaret and late dinners: Park Street was where Calcutta went out.'),
             ('Now', 'The bars', 'Someplace Else, Tantra, Agni and Aqua carry it on.')]
    c = ''.join(f'''<div class="card"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span>{k}</span>{dots(i + 1)}</div>
<div class="big mt-m">{n}</div><p class="ink2 foot">{d}</p></div>''' for i, (n, k, d) in enumerate(cards))
    body = f'''<div class="g4">{lab('The insight', pg('insight'))}</div>
<h2 class="h-display mt-m"><span class="g">The Park is named</span> after a street.</h2>
<div class="g4 grow" style="margin-top:calc(var(--u)*3)"><div class="c24 g4 g3 stagger">{c}</div></div>'''
    return slide('insight', 'The Park today · the insight', body, dark=True, src='Sources: The Park Hotels history; THE Park Kolkata and New Delhi dining. Full list on the last page.')


def ch_idea():
    return chapter('ch-idea', '02', ('Park Street,', 'everywhere.'),
                   'Each of THE Park’s hotels becomes the Park Street of its city, <b>told through a magazine of its nights.</b>',
                   [(pg('mindmap'), 'The content map', 'mindmap'), (pg('ref-named'), 'The references', 'ref-named'),
                    (pg('mix'), 'The mix', 'mix'), (pg('feed'), 'The grid', 'feed'), (pg('voice'), 'The voice', 'voice'),
                    (pg('sessions'), 'The Sessions', 'sessions'), (pg('reel'), 'The Reel', 'reel'), (pg('room'), 'Room 1967', 'room'),
                    (pg('flurys'), 'Flurys 100', 'flurys')])


def _map_tree():
    """The content map as a branching list, shown on phones in place of the drawing."""
    br = ''.join(f'<div class="br"><span class="pill t-{PILLAR[p]}">{p}<small>{w}</small></span><ul>'
                 + ''.join(f'<li{" class=hero" if h else ""}><b>{n}</b><span>{see}</span><em>{fmt}</em></li>' for n, see, fmt, h in series)
                 + '</ul></div>' for p, w, _, series in art.MAP)
    return f'<div class="map-tree"><p class="idea">Park Street, everywhere</p>{br}</div>'


def mindmap():
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The content map', pg('mindmap'))}{hh('The content', 'map.')}</div>
  <p class="lede-s c4 end">One idea, four pillars, fifteen series. <b>The three in orange get their own pages.</b></p>
</div>
<div class="map mt-s">{art.content_map()}{_map_tree()}</div>'''
    return slide('mindmap', 'The idea · the content map', body, src='Every post ends one tap from a table or a room. Venues to confirm with the brand team. Pillars, series and formats are Mask360’s proposal.')


# the reference clips, four lessons of five: (slug, source as shown on screen, what you see, what we take, the series it feeds)
REFS = {
    'ref-named': (('Name', 'the series.'), 'The Savoy, Raffles and The Roseate name each format <b>and put the name on screen.</b>',
                  'The Sessions, Room 1967 and Flurys 100 run the same way.', [
        ('savoy-breakfast', 'The Savoy', 'Breakfast at the Savoy: the trolley, the butler, the London Eye.',
         'A title card and a ritual. Flurys 100 opens like this.', 'The Table · Flurys 100'),
        ('amankila-hotel-diaries', 'Amankila', 'Hotel Diaries: one stay, with the series name over every shot.',
         'A creator with a named format. The Night Off.', 'The City · The Night Off'),
        ('raffles-jaipur-postcards', 'Raffles Jaipur', 'Postcards from Raffles Jaipur: a vintage car, the courtyards, guests.',
         'A palace told as postcards. Ran Baas, the same way.', 'THE Park Collection'),
        ('presidential-suite', 'Hotel not named', 'The Presidential Suite, reimagined: fabric, tassels, chandelier, terrace.',
         'One suite remade, shown detail by detail. Room 1967.', 'By Design · Room 1967'),
        ('roseate-food', 'The Roseate', 'Food by Roseate: a drink built by hand, under the series name.',
         'One title held on screen. Chef’s Counter keeps its name.', 'The Table · Chef’s Counter')]),
    'ref-craft': (('Film the craft', 'up close.'), 'Hands, steel, steam and one line of type. <b>The chef never has to talk.</b>',
                  'Chef’s Counter, The Object and The 3 a.m. Menu are filmed this way.', [
        ('bulgari-niko-romito', 'Bulgari Dubai', 'Two kitchens, Il Ristorante Niko Romito and Hoseki: one line per shot. “Every cut symbolises a choice.”',
         'The kitchen speaks in captions. Chef’s Counter in thirty seconds.', 'The Table · Chef’s Counter'),
        ('rosewood-dinner', 'Rosewood', 'Dinner: the lamps, the chef, the pantry, the pour.',
         'Low light and warm wood. The 3 a.m. Menu looks like this.', 'After Hours · The 3 a.m. Menu'),
        ('bulgari-la-terrazza', 'Bulgari Dubai', 'La Terrazza: old photographs, the chef, the orange trees, the cones.',
         'The archive and the kitchen in one cut. Flurys 100.', 'The Table · Flurys 100'),
        ('bulgari-dubai-details', 'Bulgari Dubai', 'Details in eighteen seconds: a plate, a cushion, the cones, a pizza.',
         'One object a beat, the name at the end. The Object.', 'By Design · The Object'),
        ('bulgari-roma', 'Bulgari Roma', 'Rome from the roof, the sign, the stair, and “Casa fondata nel 1884”.',
         'A building with a past, told by its details. The Architects.', 'By Design · The Architects')]),
    'ref-people': (('Put the people', 'first.'), 'The team is the cast: <b>the housekeeper, the doorman, the cook at the pass.</b>',
                   'Night Shift, Ask the Concierge and Who’s Playing start here.', [
        ('mama-shelter', 'Mama Shelter', 'The chefs and a dog out front, then fast cuts, food and laughs.',
         'The team as the cast, at full speed. Who’s Playing.', 'After Hours · Who’s Playing'),
        ('housekeeping', 'Hotel not named', 'A housekeeper at work: the bed, the terrace, the flowers, the doors.',
         'The people who make the room, on camera. Night Shift.', 'The City · Night Shift'),
        ('savoy-check-in', 'The Savoy', 'The Check-in: the revolving door, the bell, the desk, a card.',
         'Nine seconds of service, named as a series. Ask the Concierge.', 'The City · Ask the Concierge'),
        ('lacoste-collab', 'Hoxton × Lacoste', 'Lacoste at The Hoxton: pillows, robes, a menu drawn by hand, friends.',
         'A partner you can see in every object. Room 1967’s designer.', 'By Design · Room 1967'),
        ('white-lotus-loop', 'Four Seasons', 'A drink set down on a White Lotus × Four Seasons coaster: one shot, seven seconds.',
         'One shot that loops. The cover of every Who Played post.', 'After Hours · Who Played')]),
    'ref-rooms': (('Make the room', 'the story.'), 'A door, a window, a view, <b>in one move and in under a minute.</b>',
                  'Room 1967, The Architects and every launch kit open this way.', [
        ('roseate-delhi', 'The Roseate', 'New Delhi at dusk: water, walls and lamps, the name held still.',
         'Architecture at the blue hour. THE Park New Delhi has the light.', 'By Design · The Architects'),
        ('four-seasons-suites', 'Four Seasons', 'Just got suite-er: suites by the sea and in the city, then the booking line.',
         'The last frame says where to book. For Room 1967, a WhatsApp line.', 'By Design · Room 1967'),
        ('room-walk', 'Hotel not named', 'Door to window in one walk: the hall, the lamp, the cornice, the marble.',
         'One move through a room. Each launch kit starts here.', 'By Design · Opening Night'),
        ('small-room', 'Hotel not named', 'A small room in big type: the case, the hangers, the screen, sleep.',
         'Wit for a small room. Zone by The Park speaks like this.', 'Zone by The Park'),
        ('florence-villa', 'Hotel not named', 'Florence from the window: the tea, the pool, a fresco, the Duomo.',
         'A day in under thirty seconds, slow. THE Park Collection.', 'THE Park Collection')]),
}
REF_IDS = list(REFS)


def ref(sid):
    (grey, ink), line, take, clips = REFS[sid]
    k = REF_IDS.index(sid)
    first = sum(len(REFS[r][3]) for r in REF_IDS[:k])
    cards = ''.join(video_card(MEDIA[s], f'{first + i + 1:02d}', src, cap, tk, ser) for i, (s, src, cap, tk, ser) in enumerate(clips))
    body = f'''<div class="g4 grow">
  <div class="c1 stack-l pr">{lab(f'References · {k + 1} of 4', pg(sid))}{hh(grey, ink, cls='h1 h1-s')}
    <p class="lede-s">{line}</p>
    <p class="ink2 f-s rule">{take}</p>
    <p class="mono mute mt-auto">Press play for sound</p></div>
  <div class="c24 refs" style="grid-template-columns:repeat(5,minmax(0,1fr))">{cards}</div>
</div>'''
    return slide(sid, f'The idea · references {k + 1} of 4', body,
                 src='Clips from hotel and brand feeds, shared for direction. Mask360 did not make them. Brands are named only where the clip shows them.')


MIX = [  # pillar, formats; its days and series come from WEEKLY
    ('After Hours', 'Reels · carousels · YouTube'),
    ('The Table', 'Reels · carousels'),
    ('The City', 'Carousels · collab Reels'),
    ('By Design', 'Reels · Pinterest'),
]
DAYS = ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')


def mix():
    week = {n: [(DAYS[d], x) for d in sorted(WEEKLY) for k, x in WEEKLY[d] if k == TAG[n]] for n, _ in MIX}
    cols = ''.join(f'''<div class="post-card pillar-{PILLAR[n]}"><div class="pc-h"><p class="lab">{n}</p>{dots()}</div>
<div class="pic-t"><div class="tile t-{PILLAR[n]} fill"><div class="ov"><ul class="mixl">{"".join(f'<li><span class="mono">{d}</span>{x}</li>' for d, x in week[n])}</ul>
<p class="mixn"><span class="t">{len(week[n])}</span><span class="mono">{"Post" if len(week[n]) == 1 else "Posts"} a week</span></p></div></div></div>
<div class="pc-b"><p class="h3">{f}</p></div></div>''' for n, f in MIX)
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The mix', pg('mix'))}{hh('Eight posts', 'a week.', cls='h1')}</div>
  <p class="lede-s c4 end">Food, drink and nightlife are 43% of revenue, <b>so the night and the table get five of the eight.</b></p>
</div>
<div class="g4 mt-auto cardrow">{cols}</div>'''
    return slide('mix', 'The idea · the mix', body, src='Feed posts a week on @theparkhotels: 4 Reels and 4 carousels. Stories run daily on top. Mask360’s proposal.')


PHOTO_REFERENCE = {
    1: ('ref-after-hour.jpeg', 'Client-supplied reference: an illuminated After Hours sign above a dark venue entrance.', '50% 32%'),
    2: ('ref-the-city.jpeg', 'Client-supplied reference: a sea and palms seen through a hotel-room window.', '50% 62%'),
    3: ('ref-the-dining.jpeg', 'Client-supplied reference: a dining room overlooking a city at dusk.', '50% 69%'),
    4: ('ref-morning-read.jpeg', 'Client-supplied reference: a guest reading beside a bright hotel-room window.', '50% 58%'),
    5: ('ref-objective.jpeg', 'Client-supplied reference: a sunlit bed with an open book.', '50% 48%'),
    6: ('ref-the-city.jpeg', 'Client-supplied reference: a sea and palms seen through a hotel-room window.', '50% 76%'),
    7: ('ref-after-hour.jpeg', 'Client-supplied reference: an illuminated After Hours sign above a dark venue entrance.', '50% 47%'),
    8: ('ref-the-dining.jpeg', 'Client-supplied reference: a dining room overlooking a city at dusk.', '50% 82%'),
    9: ('ref-morning-read.jpeg', 'Client-supplied reference: a guest reading beside a bright hotel-room window.', '50% 70%'),
}


def photo_img(cell, alt=None):
    filename, reference_alt, position = PHOTO_REFERENCE[cell]
    return (f'<img class="crop-image" src="media/{filename}" alt="{esc(alt or reference_alt)}" '
            f'style="--photo-position:{position}">')


FEED = [  # the nine sample posts on Saturday 12 December: date, series, format, cover line, pillar, visual cell
    ('Sat 12 Dec', 'The Sessions · Set 01', 'reel', 'Park Street still plays', 'After Hours', 1),
    ('Fri 11 Dec', 'Who’s Playing', 'reel', 'Tonight at Someplace Else', 'After Hours', 2),
    ('Thu 10 Dec', 'The 3 a.m. Menu', 'reel', 'The kitchen just ate', 'After Hours', 3),
    ('Wed 9 Dec', 'Room 1967', 'carousel', 'The search opens', 'By Design', 5),
    ('Tue 8 Dec', 'Christmas at Flurys', 'carousel', 'The menu is out', 'The Table', 4),
    ('Mon 7 Dec', 'Who Played', 'carousel', 'Last night’s set list', 'After Hours', 2),
    ('Mon 7 Dec', 'Night Shift', 'carousel', 'The night manager', 'The City', 6),
    ('Sun 6 Dec', 'The Recipe', 'carousel', 'Save this one', 'The Table', 3),
    ('Sat 5 Dec', 'The Night Map', 'carousel', 'Kolkata after dark', 'The City', 7),
]
GLYPH = {'reel': '<svg class="gl" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2 L10 6 L3 10 Z"/></svg>',
         'carousel': '<svg class="gl" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.5 H10.5 V8.5 M1.5 3.5 H8.5 V10.5 H1.5 Z"/></svg>'}
ICONS = ('<svg class="acts" viewBox="0 0 120 20" aria-hidden="true"><path d="M10 17 C3 12 1 9 1 6 A4.5 4.5 0 0 1 10 4 A4.5 4.5 0 0 1 19 6 '
         'C19 9 17 12 10 17 Z M34 4 H52 V14 H40 L34 18 Z M64 10 L82 3 L76 18 L73 12 Z M104 2 H116 V18 L110 13 L104 18 Z"/></svg>')


def feed():
    tiles = ''.join(f'''<div class="tile ptile t-{PILLAR[p]} photo portrait">{photo_img(cell)}<div class="ov">{GLYPH[f]}<span class="t">{cover}</span></div></div>'''
                    for _, s_, f, cover, p, cell in FEED)
    hl = ''.join(f'<span><i class="t-{PILLAR[p]}"></i>{x}</span>' for x, p in (('Sessions', 'After Hours'), ('Rooms', 'By Design'), ('Flurys', 'The Table'), ('Night Map', 'The City')))
    body = f'''<div class="g4 grow feed" style="grid-template-rows:auto 1fr">
  <div class="c12 stack-l">{lab('The grid', pg('feed'))}{hh('The grid on', '12 December.')}</div>
  <div class="c1 stack-l end pr" style="grid-row:2">
    <p class="lede-s">Nine posts, <b>four pillars, one street.</b></p>
    <p class="ink2 f-s">Reels for the night, carousels to save, and the highlights for the series that run all year.</p>
    {pillar_key('key-l')}
  </div>
  <div class="post c2 end mr-1" style="grid-row:2">
    <div class="post-head"><span class="av">{P_MARK}</span><span><b>theparkhotels</b><span>Someplace Else, Kolkata</span></span></div>
    <div class="tile post-img t-after photo portrait">{photo_img(1)}<div class="ov"><p class="hook"><span class="hk">11:40</span><span class="mono">p.m., Park Street</span></p>{GLYPH['reel']}<span class="t">Park Street still plays</span></div></div>
    {ICONS}
    <p class="cap"><b>theparkhotels</b> Set 01 is up. One take at Someplace Else, Park Street. Message us for a table on Saturday.</p>
    <p class="mono mute">Sat 12 Dec · The Sessions · Reel</p>
  </div>
  <div class="c34 mid" style="grid-row:1/3">
    <div class="phone" role="img" aria-label="A phone showing the @theparkhotels profile and its nine latest posts">
      <div class="ph-head"><span class="av">{P_MARK}</span><span class="hd"><b>theparkhotels</b><span>Anything but ordinary. Park Street, everywhere.</span></span></div>
      <div class="btns"><span>Follow</span><span>Message</span><span>Contact</span></div>
      <div class="hl">{hl}</div>
      <div class="pgrid">{tiles}</div>
    </div>
  </div>
</div>'''
    return slide('feed', 'The idea · the grid', body, src='Visual references supplied by the client. The nine posts mix Reels and carousels; dates, series and copy are Mask360’s proposal.')


def voice():
    posts = [('Carousel', 'Who Played', 'Last night at Someplace Else. Swipe for the set list.', 'After Hours', 1),
             ('Reel', 'The 3 a.m. Menu', '3 a.m. at Fire, the kitchen just ate. Tomorrow, it’s on the menu.', 'After Hours', 3),
             ('Carousel', 'Room 1967', 'One suite, one designer. The first look is here.', 'By Design', 5)]
    c = ''.join(f'''<div class="card vpost"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span>{f}</span>{dots()}</div>
<div class="vimage photo landscape">{photo_img(cell)}</div>
<div class="post-head"><span class="av">{P_MARK}</span><span><b>theparkhotels</b><span>{s}</span></span></div><p class="say">{b}</p></div>'''
                for i, (f, s, b, p, cell) in enumerate(posts))
    rules = [('Name the place and the time', 'Park Street at 11:40 p.m. carries the night.'), ('Twenty words at most', 'The picture does the rest.'),
             ('Talk like the night manager', 'Warm, sure, and in on the secret.')]
    r = ''.join(f'<div><span class="mn">0{i + 1}</span><p class="q">{a}</p><span class="x"></span><p class="a">{b}</p></div>' for i, (a, b) in enumerate(rules))
    body = f'''<div class="g4 grow">
  <div class="c1 stack-l pr">{lab('The voice', pg('voice'))}{hh('How the', 'feed sounds.', cls='h1 h1-s')}
    <div class="acc tight mt-auto flush">{r}</div></div>
  <div class="c24 g4 g3 stagger">{c}</div>
</div>'''
    return slide('voice', 'The idea · voice', body, src='Visual references supplied by the client. Sample captions by Mask360; venues to confirm with the brand team.')


def _idea_page(sid, no, pillar, name, meta, cell, image_alt, headline, text, extra, src):
    kv = ''.join(f'<div><span class="k">{k}</span><span class="v">{v}</span></div>' for k, v in [('Pillar', pillar)] + meta)
    body = f'''<div class="g4 grow">
  <div class="pic c12 mr-2 photo landscape">{photo_img(cell, image_alt)}<div class="ov"><span class="no">{no} · Visual direction</span></div></div>
  <div class="c34 stack-l idea-body">
    {lab(name, pg(sid))}
    <div class="kv">{kv}</div>
    <h2 class="idea-name">{name}</h2>
    <p class="lede-s">{headline}</p>
    <p class="ink2">{text}</p>
    {extra}
  </div>
</div>'''
    return slide(sid, f'The idea · {name}', body, src=src)


def _posts(cells, caption):
    shots = ''.join(f'<div class="sample-shot photo portrait">{photo_img(cell)}<span class="sample-label">0{i + 1} / {label}</span></div>'
                    for i, (cell, label) in enumerate(cells))
    return f'''<div class="g4 g2 mt-auto" style="align-items:end">
  <div class="sample-photos">{shots}</div>
  <div class="rule-plan"><p class="mono mute">Sample caption</p><p class="say mt-s" style="font-size:calc(var(--u)*1.15)">{caption}</p></div></div>'''


def sessions():
    return _idea_page('sessions', 'No. 01', 'After Hours', 'The Sessions',
                      [('Format', 'Reel · YouTube · Spotify'), ('Cadence', 'One set a month'), ('Where', 'Someplace Else, Kolkata'),
                       ('Sells', 'Saturday tables, booked on WhatsApp')],
                      1, 'Client-supplied visual reference: the After Hours entrance, lit for a night out.', 'Someplace Else, <b>one take a month.</b>',
                      'A live set filmed at Someplace Else in a single take, with bands playing their own songs. Reels from the set '
                      'run all month and the full set goes on YouTube. Then Agni in Delhi, and each city’s own venue.',
                      _posts([(1, 'Reel'), (2, 'Carousel'), (7, 'Story')], 'Saturday, 11:40 p.m. Someplace Else, Park Street. One take, start to finish.'),
                      'Visual references supplied by the client. Band, venue and final photography to agree with the brand team. Original music and releases to be confirmed.')


def reel():
    beats = [(0, 3, 'The hook', 'The first chord over 11:40 p.m., Park Street, on screen.'),
             (3, 10, 'The walk', 'One take through the room, towards the stage.'),
             (10, 25, 'The chorus', 'Hold on the room as the chorus takes over.'),
             (25, 30, 'The last note', 'Return to the entrance. End on the full set.')]
    visual_cells = (1, 3, 8, 7)
    cells = ''.join(f'''<div class="post-card beat"><div class="pc-h"><span class="mono"><span class="k">Sec</span>{s} to {e}</span>
<div class="track" role="img" aria-label="Seconds {s} to {e} of 30"><i style="margin-left:{s / 30 * 100:.1f}%;width:{(e - s) / 30 * 100:.1f}%"></i></div></div>
<div class="art photo landscape">{photo_img(visual_cells[i])}</div><div class="pc-b"><p class="lab">{a}</p><p class="ink2">{b}</p></div></div>''' for i, (s, e, a, b) in enumerate(beats))
    spec = [('Sound', 'The band’s own track, as original audio'), ('Cover', 'The 11:40 frame, with Park Street still plays'),
            ('End card', 'The full set on YouTube'), ('Then', 'Message us for a table')]
    sp = ''.join(f'<div><p class="mono mute">{k}</p><p class="h4 mt-s" style="margin-top:calc(var(--u)*.35)">{v}</p></div>' for k, v in spec)
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The Reel', pg('reel'))}{hh('Set 01,', 'second by second.', cls='h1')}</div>
  <p class="lede-s c4 end">A thirty-second Reel cut from the one take, <b>made for the first three seconds and the save.</b></p>
</div>
<div class="g4 mt-auto cardrow two-up">{cells}</div>
<div class="spec mt-s">{sp}</div>'''
    return slide('reel', 'The idea · the Reel', body, src='Visual references supplied by the client. A sample cut by Mask360; timings in seconds.')


def room():
    return _idea_page('room', 'No. 02', 'By Design', 'Room 1967',
                      [('Format', 'Reel · story · carousel'), ('Cadence', 'One suite a year'), ('Where', 'One of THE Park’s hotels'),
                       ('Sells', 'Room nights, from a waiting list')],
                      5, 'Client-supplied visual reference: a quiet, sunlit bedroom with a book left open.', 'One suite a year, <b>revealed on the feed.</b>',
                      'A young Indian designer remakes one suite at THE Park every year. We film it from the empty room to the '
                      'first guest, one Reel a week, and open a waiting list in stories.',
                      _posts([(5, 'Reel'), (8, 'Carousel'), (6, 'Story')], 'One designer. One year. One suite. The waiting list is in our bio.'),
                      'Visual references supplied by the client; not confirmed images of a Park property. The designer, hotel and final photography to agree with the brand team.')


def flurys():
    return _idea_page('flurys', 'No. 03', 'The Table', 'Flurys 100',
                      [('Format', 'Reel · story · carousel'), ('Cadence', 'All of 2027'), ('Where', 'Park Street to Gurugram'),
                       ('Sells', 'Visits to 111 stores, and every new café')],
                      3, 'Client-supplied visual reference: an atmospheric dining room above the city at dusk.', 'A hundred stories <b>for a hundred years.</b>',
                      'Flurys turns 100 in 2027. All year we tell one story at a time: a regular, a recipe, a baker at 4 a.m. '
                      'From the tea room on Park Street to the 24-hour café in Gurugram.',
                      _posts([(3, 'Carousel'), (4, 'Reel'), (5, 'Story')], 'Regular No. 001. Same table, every Sunday. Swipe for the order.'),
                      'Visual references supplied by the client; not confirmed Flurys assets. Product, café and final photography to agree with the brand team. Flurys opened its 24-hour Gurugram café on 7 August 2026.')


def ch_run():
    return chapter('ch-run', '03', ('How it', 'runs.'), 'From December on the feed to the first readout in February, <b>and the people behind it.</b>',
                   [(pg('calendar'), 'A month', 'calendar'), (pg('handles'), 'The handles', 'handles'), (pg('community'), 'The people', 'community'),
                    (pg('measure'), 'The measures', 'measure'), (pg('mask360'), 'Mask360', 'mask360'), (pg('faq'), 'Quick answers', 'faq'),
                    (pg('next'), 'Next steps', 'next')])


# a month on the feed: the series by weekday (pillar class a After Hours, b By Design, c The Table, d The City), then the one-offs
WEEKLY = {0: [('a', 'Who Played'), ('d', 'Night Shift')], 1: [('c', 'Chef’s Counter')], 2: [('b', 'The Object')],
          3: [('a', 'The 3 a.m. Menu')], 4: [('a', 'Who’s Playing')], 5: [('d', 'The Night Map')], 6: [('c', 'The Recipe')]}
SPECIAL = {dt.date(2026, 12, 1): [('a', 'New Year’s Eve: tables open')],
           dt.date(2026, 12, 8): [('c', 'Christmas at Flurys: the menu')],
           dt.date(2026, 12, 9): [('b', 'Room 1967: the search opens')],
           dt.date(2026, 12, 12): [('a', 'The Sessions · Set 01')],
           dt.date(2026, 12, 16): [('b', 'The Architects')],
           dt.date(2026, 12, 17): [('a', 'Two weeks to New Year’s Eve')],
           dt.date(2026, 12, 24): [('a', 'Christmas Eve on Park Street')],
           dt.date(2026, 12, 25): [('a', 'Christmas on Park Street'), ('c', 'Christmas at Flurys')],
           dt.date(2026, 12, 28): [('a', 'Last tables for New Year’s Eve')],
           dt.date(2026, 12, 31): [('a', 'New Year’s Eve at every THE Park')],
           dt.date(2027, 1, 1): [('a', 'Who Played: New Year’s Eve')]}


def calendar():
    start = dt.date(2026, 11, 30)  # the Monday before 1 December
    head = ''.join(f'<span class="wd">{d}</span>' for d in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'))
    cells = []
    for i in range(35):
        day = start + dt.timedelta(days=i)
        tags = SPECIAL.get(day, WEEKLY[day.weekday()])
        cls = 'day'
        if day in SPECIAL:
            cls += ' tent'
        elif day.month != 12:
            cls += ' out'
        if day.month != 12:
            cls += ' nm'  # outside December, greyed even when it is a one-off day
        elif day.day > 7 and day not in SPECIAL:
            cls += ' rep'  # a weekly repeat, folded away on phones
        t = ''.join(f'<span class="tag {k}">{x}</span>' for k, x in tags)
        wd = f'{day:%a}' if day.month == 12 else f'{day:%a} · {day:%b}'
        cells.append(f'<div class="{cls}"><span class="n" data-wd="{wd}">{day.day}</span>{t}</div>')
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('A month', pg('calendar'))}{hh('December', 'on the feed.')}</div>
  <div class="c34 end stack cal-side">{pillar_key()}
    <p class="mono mute"><span style="display:inline-block;width:calc(var(--u)*1.2);height:2px;background:var(--accent);vertical-align:middle"></span>&ensp;Orange rule: a one-off post</p></div>
</div>
<div class="cal mt-m">{head}{''.join(cells)}</div>
<p class="cal-note ink2">From 8 December the list shows the one-off days. Each takes that day’s weekly slot.</p>'''
    return slide('calendar', 'How it runs · a month', body, src='Assumes a start on 16 November 2026. New Year’s Eve tables open on 1 December, a month ahead.')


def _handles_tree():
    def items(rows):
        return ''.join(f'<li><b>{n}</b><em>{v}</em><span>{w}. {h}.</span></li>' for n, v, w, h in rows)
    return (f'<div class="map-tree"><p class="idea hub">@theparkhotels · the group feed</p>'
            f'<div class="br"><p class="mono mute">The best of each hotel runs here</p><ul>{items(art.HANDLES[:3])}</ul></div>'
            f'<div class="br"><p class="mono mute">Each new hotel gets a launch kit</p><ul>{items(art.HANDLES[3:])}</ul></div></div>')


def handles():
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The handles', pg('handles'))}{hh('Every brand speaks', 'in its own voice.')}</div>
  <p class="lede-s c4 end">Each of THE Park’s hotels films its own version of the series. <b>A new hotel opens with nine posts ready.</b></p>
</div>
<div class="map mt-s">{art.handles_map()}{_handles_tree()}</div>'''
    return slide('handles', 'How it runs · the handles', body, src='Venue accounts to confirm with the brand team. Voices and roles are Mask360’s proposal.')


def community():
    cols = [('Artists', 'A new band each month for The Sessions. One designer a year for Room 1967.'),
            ('Regulars', 'Their photos, reposted with credit. Their nominations for Night Shift.'),
            ('Creators', 'One city creator a month spends The Night Off with us, as a collab Reel.'),
            ('Direct messages', 'Every message gets a person, and a table if they want one.')]
    c = ''.join(f'''<div class="post-card ppl"><div class="pc-h"><span class="mono"><span class="k">Group</span>0{i + 1}</span>{dots()}</div>
<div class="art">{art.people(i)}</div><div class="pc-b"><p class="h3">{a}</p><p class="ink2">{b}</p></div></div>''' for i, (a, b) in enumerate(cols))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The people', pg('community'))}{hh('The people who', 'make the feed.', cls='h1')}</div>
  <p class="lede-s c4 end">Four groups, <b>each with a job on the feed.</b></p>
</div>
<div class="g4 mt-auto cardrow">{c}</div>'''
    return slide('community', 'How it runs · community', body, src='Artists and creators to agree with each hotel.')


def measure():
    rows = [('Skip rate and watch time', 'Per Reel series, from Instagram Insights, weekly'),
            ('Saves and shares per post', 'From Insights, against your last 30 posts'),
            ('WhatsApp chats from social', 'A tagged link per series'),
            ('Tables booked from social', 'A code per venue'),
            ('Room nights booked direct', 'From the booking engine, with tagged links')]
    acc = ''.join(f'<div{" class=open" if i == 0 else ""}><span class="mn">0{i + 1}</span><p class="q">{a}</p><span class="x"></span><p class="a">{b}</p></div>'
                  for i, (a, b) in enumerate(rows))
    body = f'''<div class="g4 grow">
  <div class="c12 stack-l pr">{lab('The measures', pg('measure'))}{hh('Measured in', 'your numbers.', cls='h1')}
    <div class="g4 g2 mt-auto stat-pair">{stat('2×', 'Saves', 'Saves per post against your last 30: a draft threshold, set from your data in week 2.', '01')}{stat('22 Feb', 'First readout', 'Week of 22 February 2027. A series that trails is replaced.', '02')}</div></div>
  <div class="c34 acc end">{acc}</div>
</div>'''
    return slide('measure', 'How it runs · measurement', body, src='Measures and targets are Mask360’s proposal.')


def mask360():
    cards = [('Hospitality we have worked with', 'Anantara Jewel Bagh, Jaipur · Alta Stella, Onrique and DEA, Mumbai · Atlantis The Royal and SANA, Dubai'),
             ('Feeds we run', 'The Penthouse at St. Regis Mumbai · Moxy Mumbai'),
             ('Luxury we have worked with', 'Dior · Ferrari India · L’Oréal · Dyson')]
    c = ''.join(f'<div class="card"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span>{a}</span>{dots()}</div><p class="f-l mt-s">{b}</p></div>'
                for i, (a, b) in enumerate(cards))
    lounge = f'''<div class="card"><div class="card-h"><span class="mono"><span class="k">04</span>A lounge we built</span>{dots()}</div>
<div class="big mt-s">530</div><p class="ink2">Tickets at ₹75,000 each: the Nexa Platinum Lounge, Lollapalooza India.</p></div>'''
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('Mask360', pg('mask360'))}<div class="m-logo" style="width:78%;margin-top:calc(var(--u)*1.4)"><svg viewBox="0 0 1632 473" role="img" aria-label="Mask360"><use href="#logo-m"/></svg></div></div>
  <h2 class="h2 c34 end">We run social and content for luxury and hospitality brands in India and the UAE.</h2>
</div>
<div class="g4 mt-auto cred">{c}{lounge}</div>'''
    return slide('mask360', 'How it runs · Mask360', body, dark=True, src='From Mask360’s own records.')


def faq():
    qa = [('When could it start?', 'The plan assumes a start on 16 November 2026, which puts Set 01 on the feed on Saturday 12 December.'),
          ('Will every hotel post the same thing?', f'No. Each THE Park hotel films its own version of the series, and every other brand speaks in its own '
           f'voice (P. {pg("handles")}). The best of every city runs on @theparkhotels.'),
          ('What about music rights and drinks rules?', 'Bands play their own songs and sign a release, so the full set can run on YouTube. '
           'No drinks brands appear in frame.'),
          ('How will we know it works?', 'We count saves, WhatsApp chats and tables booked from social, every week. The first readout is in '
           'the week of 22 February 2027, and a series that trails is replaced.'),
          ('What do you need from us?', 'Thirty minutes with the brand team, a contact at each venue, tagged links in the booking engine, and a hotel for Room 1967.'),
          ('What will it cost?', 'We bring a costed plan to the pitch, handle by handle.')]
    acc = ''.join(f'<div{" class=open" if i == 0 else ""}><span class="mn">0{i + 1}</span><p class="q">{q}</p><span class="x"></span><p class="a">{a}</p></div>'
                  for i, (q, a) in enumerate(qa))
    body = f'''<div class="g4 grow">
  <div class="c12 stack-l pr">{lab('Quick answers', pg('faq'))}{hh('Quick', 'answers.', cls='h1')}
    <p class="lede-s" style="max-width:24em">Six questions the brand team will ask, <b>answered before the pitch.</b></p></div>
  <div class="c34 acc end">{acc}</div>
</div>'''
    return slide('faq', 'How it runs · quick answers', body, src='Dates and measures as set out on the earlier pages.')


def next_steps():
    steps = ['Shortlist Mask360', 'Thirty minutes with the brand team', 'The pitch: the full plan, handle by handle', 'Set 01 at Someplace Else in December']
    path = ''.join(f'<div><span class="mn">0{i + 1}</span><p class="q">{s}</p></div>' for i, s in enumerate(steps))
    gets = ['This proposal, walked through for your hotels', 'A fit check, both ways', 'Clear next steps to the pitch']
    checks = ''.join(f'<li>{g}</li>' for g in gets)
    body = f'''<div class="g4 grow">
  <div class="c12 stack-l pr">{lab('Next steps', pg('next'))}
    <h2 class="h-display next-h"><span class="g">Put us</span> in the room.</h2>
    <p class="lede-s" style="max-width:26em">Shortlist Mask360 <b>and we bring the full plan to the pitch.</b></p>
    <div class="acc tight flush path">{path}</div>
    <div class="mt-auto stack">
      <p class="mono"><span class="k">Founder</span>Kaavish Ramchandani</p>
      <a class="mail" href="mailto:kaavish@mask360.agency">kaavish@mask360.agency</a>
      <p class="mono"><span class="k">Phone</span><a href="tel:+919591075100">+91 959 107 5100</a></p>
      <p class="mono"><span class="k">Web</span>mask360.agency · mask360.work</p>
    </div>
  </div>
  <div class="c4 cta end">
    <p class="mono">Thirty minutes with Kaavish</p>
    <h3 class="h2"><span class="g">Ready</span> to start?</h3>
    <p class="mono">What you get</p>
    <ul class="checks">{checks}</ul>
    {btn('Book a call', 'Kaavish', 'mailto:kaavish@mask360.agency?subject=Park%20Street%2C%20everywhere')}
  </div>
</div>'''
    return slide('next', 'How it runs · next steps', body)


def close():
    nav = [('The Park today', 'ch-today'), ('The content map', 'mindmap'), ('The references', 'ref-named'), ('The grid', 'feed'),
           ('A month', 'calendar'), ('The handles', 'handles'), ('Next steps', 'next'), ('Sources', 'sources')]
    n = ''.join(f'<li><a href="#{i}">{roll(t)}</a></li>' for t, i in nav)
    body = f'''<div class="g4">{WORDMARK}<p class="lab c3"><span>Thank you</span></p></div>
<div class="g4 grow" style="grid-template-rows:1fr auto;row-gap:calc(var(--u)*2.4)">
  <div class="c34 end g4 g2 as foot" style="grid-row:1">
    <ul class="nav">{n}</ul>
    <div class="stack">
      <h2 class="lede-s">Park Street, <b>everywhere.</b></h2>
      <a class="mail" href="mailto:kaavish@mask360.agency" style="font-size:calc(var(--u)*1.6)">kaavish@mask360.agency</a>
      <p class="mono"><span class="k">Phone</span><a href="tel:+919591075100">+91 959 107 5100</a></p>
    </div>
  </div>
  <div class="giant c12 end" style="grid-row:2"><svg viewBox="0 0 1632 473" role="img" aria-label="Mask360"><use href="#logo-m"/></svg></div>
  <p class="mono c3 end" style="grid-row:2"><span class="k">©</span>2026 Mask360<br><span class="k">For</span>The Park Hotels</p>
  <p class="mono c4 end" style="grid-row:2"><span class="k">October</span>2026<br><span class="k">Status</span>Confidential</p>
</div>'''
    return slide('close', 'The Park Hotels × Mask360', body, bare=True, dark=True, cls='close')


def sources():
    items = ''.join(f'<div><p class="lab"><span class="mn">0{i + 1}</span><span>{h}</span></p><p class="f-s ink2 mt-s">{t}</p></div>' for i, (h, t) in enumerate(SOURCES))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('Appendix', pg('sources'))}{hh('Every number,', 'and where it came from.', cls='h1 h1-s')}</div>
</div>
<div class="srcs mt-auto">{items}</div>'''
    return slide('sources', 'Appendix · sources', body)


def slides():
    out = [cover(), promise(), brief(), ch_today(), today(), channels(), rule(), insight(), ch_idea(), mindmap()]
    out += [ref(r) for r in REF_IDS]
    out += [mix(), feed(), voice(), sessions(), reel(), room(), flurys(), ch_run(), calendar(), handles(), community(), measure(),
            mask360(), faq(), next_steps(), close(), sources()]
    assert [s.split('id="', 1)[1].split('"', 1)[0] for s in out] == ORDER, 'ORDER is out of step with the slides'
    return out
