"""Slide copy for Mask360's social media proposal to Birla Fertility & IVF, addressed to Akanksha Rana, who posted the call for
a social media agency with healthcare experience. Laid out in the Hanza look (deck.css) of Mask360's pitch to The Park Hotels,
in Birla Fertility & IVF's navy and pink: every slide sits on four column guides, headings run in two tones, small labels are
mono. The copy borrows Hanza's habits: the outcome first, a short heading with one promise line under it, numbers that say
why they matter, a challenge and an answer for each campaign, a short process, and a close that says what the first meeting
gives you. Facts come from pitches/birla-fertility/README.md. A cold pitch is conversation one, so there is no pricing."""
import datetime as dt
import art
from kit import (slide, ul, table, tile, fab, chapter, btn, lab, dots, hh, stat, M_MARK, WORDMARK, AV)

TITLE = 'Birla Fertility & IVF × Mask360'
DESCRIPTION = ('Mask360’s social media proposal to Birla Fertility &amp; IVF, October 2026: No question too quiet. The content map, '
               'the grid, a month on the feed, three sample campaigns and a sensitivity code for the new NMC rules.')

# the slides in deck order; page references on the slides are looked up here
ORDER = ['cover', 'promise', 'brief', 'ch-today', 'today', 'channels', 'rivals', 'law', 'rule', 'insight', 'ch-idea', 'mindmap',
         'mix', 'feed', 'voice', 'asked', 'questions', 'half', 'goodnews', 'voices', 'ch-run', 'steps', 'calendar', 'handles',
         'code', 'care', 'measure', 'mask360', 'next', 'close', 'sources']


def pg(sid):
    return f'{ORDER.index(sid) + 1:02d}'


def words(text, accent=()):
    """The statement, one span a word, so the words can turn from pale to ink as the page arrives (deck.js)."""
    out = []
    for w in text.split(' '):
        bare = w.strip('.,’')
        out.append(f'<span class="w{" or" if bare in accent else ""}">{w}</span>')
    return ' '.join(out)


# full sources, shown on the last page; each slide carries a short version
SOURCES = [
    ('Social today', 'Public profiles, October 2026, approximate: @birlafertility about 35K Instagram followers; '
     '@birlafertility_armcivf about 11K; Facebook about 12K; YouTube @birlafertilityivf 470+ videos and about 10M views; X @BirlaIvf; '
     '@indiraivfgroup about 391K. 50+ centres and 120+ experts: @birlafertility on Instagram.'),
    ('The numbers', 'Over 90% of people facing fertility problems feel emotionally exhausted and 29% seek timely help: Birla Fertility '
     '&amp; IVF study, released with Fertility Circle, June 2025 (MediaBrief). Male factors in 40 to 50% of cases in India: Indian '
     'Society of Assisted Reproduction, via BioSpectrum India.'),
    ('Birla Fertility &amp; IVF', 'ARMC IVF, May 2024, and BabyScience, August 2024 (Venture Intelligence, BioSpectrum India). '
     '“All Heart. All Science.” (Digital Health News). Fertility Circle, 1800 123 1515, in English and Hindi (MediaBrief, June 2025).'),
    ('The category', 'Indira IVF: 165+ centres (Business Standard, July 2025), Tumko Meri Kasam (ThePrint, 2025). Nova IVF Fertility '
     'creator series (Confluencr). Cloudnine Fertility, “Every Fertility Journey is Different”, World IVF Day 2026 (Business News This '
     'Week). Ferty9 #TogetherInIVF (MediaNews4U). Motherhood “I Am Very Fortunate” (Motherhood India).'),
    ('The rules', 'NMC public notice of 6 October 2026, as reported by The South First and BestMediaInfo. ASCI Consumer Complaints '
     'Council releases, October 2019 and January 2020; ASCI guidelines for health and finance influencers, 2023. ART (Regulation) Act '
     '2021, section 32; Surrogacy (Regulation) Act 2021, section 38; PCPNDT Act, section 22; Drugs and Magic Remedies Act 1954, '
     'schedule (India Code). DPDP Rules, November 2025. Meta advertising standards.'),
    ('Care', 'Tele-MANAS, India’s national mental health helpline: 14416. Fertility Circle, Birla Fertility &amp; IVF’s counselling '
     'line: 1800 123 1515.'),
    ('Mask360', 'Clients, managed feeds and the Nexa Platinum Lounge result come from Mask360’s own records. Pillars, series, '
     'formats, cadence, sample posts, captions, service levels and dates are Mask360’s proposal.'),
]


def cover():
    chapters = [(pg('ch-today'), 'Your social today', 'ch-today'), (pg('ch-idea'), 'No question too quiet', 'ch-idea'),
                (pg('mindmap'), 'The content map', 'mindmap'), (pg('ch-run'), 'How it runs', 'ch-run')]
    svc = ''.join(f'<li><span class="mn">/{n}</span><a href="#{i}">{t}</a></li>' for n, t, i in chapters)
    body = f'''<div class="top">{WORDMARK}<p class="lab"><span>A social media proposal</span></p>{M_MARK}</div>
<div class="g4 grow" style="grid-template-rows:1fr auto auto;row-gap:calc(var(--u)*1.5)">
  <p class="lede-s c3 end pr" style="grid-row:2">We help Birla Fertility &amp; IVF <b>become the place India asks first.</b></p>
  <ul class="svc c4 end" style="grid-row:2">{svc}</ul>
  <p class="who c12 end" style="grid-row:3">For <b>Akanksha Rana</b> and the brand team<br>October 2026 · Confidential</p>
  <h1 class="h-display cover-h c34" style="grid-row:3"><span class="g">No question</span> too quiet.</h1>
</div>'''
    return slide('cover', 'Proposal', body, bare=True, dark=True, cls='cover scrim', cloth=('navy', 7))


def promise():
    terms = [('Asked sooner', 'People reach a specialist before the worry grows.'),
             ('Trusted in private', 'Saves, shares and DMs: the signals before a consult.'),
             ('Safe in every post', 'Checked by your doctors, written for the new NMC rules.')]
    cards = ''.join(f'''<div class="card"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span></span>{dots(i + 1)}</div>
<p class="h3 mt-m">{t}</p><p class="ink2">{d}</p></div>''' for i, (t, d) in enumerate(terms))
    body = f'''<div class="g4 grow" style="grid-template-rows:auto 1fr auto">
  <div class="c1 tile m-hide" style="grid-row:1/4;align-self:stretch;margin-right:calc(var(--u)*2)">{fab('navy', 41)}
    <div class="ov"><span class="no">The promise</span>{btn('See the map', pg('mindmap'), '#mindmap')}</div></div>
  {lab('Our promise', pg('promise'), 'c3')}
  <h2 class="q c34" style="grid-row:2;align-self:center">{words('We will make @birlafertility the account India asks first.', ('asks', 'first'))}</h2>
  <div class="c24 g4 g3 stagger" style="grid-row:3">{cards}</div>
</div>'''
    return slide('promise', 'Proposal · our promise', body)


def brief():
    rows = [('A social media agency', 'A content map, the grid, a month on the feed and every account.',
             f'{pg("mindmap")} · {pg("feed")} · {pg("calendar")} · {pg("handles")}'),
            ('Proven healthcare work', 'Swisse Wellness, live now, and our fertility thinking shown in full.', f'{pg("mask360")} · {pg("asked")}'),
            ('The category’s sensitivity', 'A sensitivity code, the new NMC rules, and a person behind every DM.',
             f'{pg("law")} · {pg("code")} · {pg("care")}'),
            ('Strategic, creative leadership', 'One idea, four pillars and twelve series, mapped down to the post.', pg('mindmap')),
            ('Case studies or sample campaigns', 'Three sample campaigns, drawn and planned.', f'{pg("asked")} · {pg("half")} · {pg("goodnews")}')]
    acc = ''.join(f'''<div{" class=open" if i == 0 else ""}><span class="mn">0{i + 1}</span><p class="q">{q}</p><span class="x"><span class="mute">P.</span> {p}</span>
<p class="a">{a}</p></div>''' for i, (q, a, p) in enumerate(rows))
    body = f'''<div class="g4 grow">
  <div class="c12 stack-l pr">{lab('Your brief', pg('brief'))}{hh('What you', 'asked for.', cls='h1 h1-l')}
    <p class="lede-s" style="max-width:24em">Your call for a social media agency, <b>answered page by page.</b></p></div>
  <div class="c34 acc mid">{acc}</div>
</div>'''
    return slide('brief', 'Proposal · your brief', body, src='From your call for agencies on LinkedIn, October 2026.')


def ch_today():
    return chapter('ch-today', '01', ('Your social', 'today.'),
                   'A strong YouTube library, two Instagram audiences <b>and new rules since 6 October.</b>',
                   ('navy', 21), ('blush', 22),
                   [(pg('today'), 'The numbers', 'today'), (pg('channels'), 'The channels', 'channels'),
                    (pg('rivals'), 'The category', 'rivals'), (pg('law'), 'The rules', 'law'),
                    (pg('rule'), 'The house rule', 'rule'), (pg('insight'), 'The insight', 'insight')])


def today():
    nums = [('29%', 'Seek help', 'Only 29% of people facing fertility problems seek timely help.', 29, '29 of every 100 people'),
            ('90%+', 'Feel exhausted', 'Over 90% feel emotionally exhausted, in your own 2025 study.', 90, '90 of every 100 people'),
            ('40%+', 'Male factors', 'Male factors play a part in 40 to 50% of cases in India.', 45, '40 to 50 of every 100 cases'),
            ('35K', 'On Instagram', 'Followers on @birlafertility, with 11K more on ARMC IVF.', 35 / 46 * 100, '35K of 46K across two accounts')]
    cells = ''.join(f'''<div class="card stat-card"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span>{k}</span>{dots(i + 1, 4)}</div>
<div class="big">{n}</div>
<div class="track" role="img" aria-label="{a}"><i style="width:{w:.0f}%"></i></div><p class="mono mute">{a}</p>
<p class="ink2">{d}</p></div>''' for i, (n, k, d, w, a) in enumerate(nums))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The numbers', pg('today'))}{hh('Only 29% seek help.', 'The feed can reach the rest.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">Over 90% feel exhausted. <b>The feed’s job is to make the first question easy to ask.</b></p>
</div>
<div class="g4 mt-auto cardrow">{cells}</div>'''
    return slide('today', 'Your social today · the numbers', body,
                 src='Sources: Birla Fertility &amp; IVF Fertility Circle study, June 2025; ISAR; public profiles, October 2026. Full list on the last page.')


CHANNELS = [  # channel, handle or status, its job, a week
    ('Instagram', '@birlafertility', 'The home of the questions: Reels, carousels, Lives', '5 posts, stories daily'),
    ('Instagram', '@birlafertility_armcivf', 'The same series in Malayalam', '3 posts'),
    ('YouTube', '@birlafertilityivf', 'Answers people search for', '3 Shorts, 2 long answers a month'),
    ('Facebook', 'Birla Fertility &amp; IVF', 'Reach beyond the metros, Hindi first', '4 posts'),
    ('LinkedIn', 'Birla Fertility &amp; IVF', 'The science and the people', '2 posts'),
    ('X', '@BirlaIvf', 'News and event days', 'On event days'),
    ('WhatsApp', 'new', 'A channel of cards made to forward', 'Weekly'),
    ('Fertility Circle', '1800 123 1515', 'The person behind every DM', 'Always on'),
]


def channels():
    def name(c, h):
        tag = '<span class="badge or">New</span>' if h == 'new' else f'<span class="mono mute">{h}</span>'
        return f'<b>{c}</b> {tag}'
    rows = [[name(c, h), j, w] for c, h, j, w in CHANNELS]
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The channels', pg('channels'))}{hh('Six channels today.', 'Each gets a job.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">We add one: <b>a WhatsApp channel of cards made to forward.</b></p>
</div>
<div class="mt-auto">{table(['Channel', 'Its job', 'A week'], rows, cls='tbl g4t tight stackable')}</div>'''
    return slide('channels', 'Your social today · the channels', body,
                 src='Channels as their public profiles show them, October 2026. Cadence is Mask360’s proposal.')


RIVALS = [  # brand, what we see on social
    ('Indira IVF', '165+ centres, about 390K on Instagram, and a 2025 feature film, Tumko Meri Kasam.'),
    ('Nova IVF Fertility', 'Doctor-led myth-busting, run as a YouTube creator series.'),
    ('Cloudnine Fertility', '“Every Fertility Journey is Different” for World IVF Day 2026, male factor included.'),
    ('Ferty9', '#TogetherInIVF: street plays and creators across Andhra Pradesh and Telangana.'),
    ('Motherhood', 'Patient gratitude stories, a format the October 2026 NMC notice now restricts.'),
    ('Birla Fertility &amp; IVF', '470+ YouTube videos that bust myths, and Fertility Circle, a free counselling line.'),
]


def rivals():
    rows = [[f'<b>{n}</b>', w] for n, w in RIVALS]
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The category', pg('rivals'))}{hh('The category', 'on social.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">What five rivals post today, <b>and where the room is: one question, owned every week.</b></p>
</div>
<div class="mt-auto">{table(['Brand', 'What we see on social'], rows, cls='tbl two stackable')}</div>'''
    return slide('rivals', 'Your social today · the category', body,
                 src='Sources: trade press and public profiles, 2025 to 2026. Follower counts are approximate. Full list on the last page.')


LAW = [  # rule, what it means on social
    ('NMC public notice, 6 October 2026', 'No testimonials or patient success stories, no “best” or guaranteed outcomes, no AI-made '
     'patients, no pay linked to referrals.'),
    ('ASCI', 'IVF success-rate and “best” claims have been upheld as misleading. Creators giving health advice state their qualifications.'),
    ('ART Act, Surrogacy Act, PCPNDT Act', 'Nothing that suggests sex selection or commercial surrogacy, on any channel.'),
    ('Drugs and Magic Remedies Act, 1954', 'Its schedule lists sterility in women, so no line reads as a cure or remedy claim.'),
    ('DPDP Act and Meta ad policy', 'Explicit consent before patient data touches marketing. Ads never imply a viewer’s health.'),
]


def law():
    rows = [[f'<b>{r}</b>', m] for r, m in LAW]
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The rules', pg('law'))}{hh('On 6 October,', 'the rules changed.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">We plan inside them from day one. <b>Your legal team signs the final checklist.</b></p>
</div>
<div class="mt-auto">{table(['Rule', 'What it means on social'], rows, cls='tbl two stackable')}</div>'''
    return slide('law', 'Your social today · the rules', body,
                 src='Sources: NMC notice as reported by The South First and BestMediaInfo; ASCI; India Code; Meta. Full list on the last page.')


def rule():
    rows = [('The question people are scared to ask', 'The 1 a.m. Questions', 'Every Monday'),
            ('A myth, checked by a specialist', 'Myth or Fact', 'Every Tuesday'),
            ('What a first visit looks like', 'Your First Visit', 'Every Friday'),
            ('Men, spoken to directly', 'Half the Story', 'Fortnightly'),
            ('The family, invited in kindly', 'The Good News Question', 'Every Saturday')]
    trs = [[f'<span class="f-l" style="font-weight:500">{a}</span>', f'<span class="sq"></span>&ensp;<b>{b}</b>', f'<span class="mono">{c}</span>']
           for a, b, c in rows]
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The house rule', pg('rule'))}{hh('If it adds pressure,', 'we don’t post it.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">Success-rate banners, stock babies and testimonials stay off the feed. <b>This goes on it.</b></p>
</div>
<div class="mt-auto">{table(['What we post', 'The series it becomes', 'How often'], rows=trs, cls='tbl half stackable')}</div>'''
    return slide('rule', 'Your social today · the house rule', body, src='Series and cadence are Mask360’s proposal.')


def insight():
    cards = [('90%+', 'Exhausted', 'Over 90% feel emotionally exhausted.'),
             ('29%', 'Unasked', 'Only 29% seek timely help.'),
             ('1 a.m.', 'Alone', 'A phone at night is where the first question gets typed.')]
    c = ''.join(f'''<div class="card"><div class="card-h"><span class="big" style="font-size:calc(var(--u)*2.6)">{n}</span>{dots(i + 1)}</div>
{lab(k)}<p class="ink2">{d}</p></div>''' for i, (n, k, d) in enumerate(cards))
    body = f'''<div class="g4">{lab('The insight', pg('insight'))}</div>
<h2 class="h-display mt-m"><span class="g">The first question</span> gets typed at 1 a.m.</h2>
<div class="g4 mt-auto"><div class="c24 g4 g3 stagger">{c}</div></div>'''
    return slide('insight', 'Your social today · the insight', body, dark=True,
                 src='Source: Birla Fertility &amp; IVF study, Fertility Circle launch, June 2025.')


def ch_idea():
    return chapter('ch-idea', '02', ('No question', 'too quiet.'),
                   'Birla Fertility &amp; IVF becomes the place India asks first, <b>with all heart and all science.</b>',
                   ('navy', 12), ('petal', 13),
                   [(pg('mindmap'), 'The content map', 'mindmap'), (pg('mix'), 'The mix', 'mix'), (pg('feed'), 'The grid', 'feed'),
                    (pg('voice'), 'The voice', 'voice'), (pg('asked'), 'The 1 a.m. Questions', 'asked'),
                    (pg('questions'), 'Month one', 'questions'), (pg('half'), 'Half the Story', 'half'),
                    (pg('goodnews'), 'The Good News Question', 'goodnews'), (pg('voices'), 'The voices', 'voices')])


def _map_tree():
    """The content map as a branching list, shown on phones in place of the drawing."""
    br = ''.join(f'<div class="br"><span class="pill">{p}<small>{w}</small></span><ul>'
                 + ''.join(f'<li{" class=hero" if h else ""}><b>{n}</b><span>{see}</span><em>{fmt}</em></li>' for n, see, fmt, h in series)
                 + '</ul></div>' for p, w, _, series in art.MAP)
    return f'<div class="map-tree"><p class="idea">No question too quiet</p>{br}</div>'


def mindmap():
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The content map', pg('mindmap'))}{hh('The content', 'map.')}</div>
  <p class="lede-s c4 end">One idea, four pillars, twelve series. <b>The three in pink get their own pages.</b></p>
</div>
<div class="map mt-s">{art.content_map()}{_map_tree()}</div>'''
    return slide('mindmap', 'The idea · the content map', body,
                 src='Every series is answered by a named specialist and reviewed before it posts. Pillars, series and formats are Mask360’s proposal.')


MIX = [  # pillar, posts a week, cloth (kind, seed, dark text), formats, days
    ('Answer', 2, ('navy', 31, False), 'Reels · carousels', 'Mon · Tue'),
    ('The Science', 1, ('petal', 32, True), 'Reels · YouTube', 'Thu'),
    ('Reassure', 1, ('blush', 33, True), 'Carousels · stories', 'Fri'),
    ('Belong', 1, ('navy', 34, False), 'Stickers · creator Reels', 'Sat'),
]


def mix():
    cols = ''.join(f'''<div class="post-card"><div class="pc-h"><span class="mono"><span class="k">{"Post" if k == 1 else "Posts"}</span>{k} a week</span>{dots(k)}</div>
<div class="pic-t">{tile(c[0], c[1], d, str(k), dark_text=c[2], cls='fill')}</div>
<div class="pc-b"><p class="lab">{n}</p><p class="h3">{f}</p></div></div>''' for n, k, c, f, d in MIX)
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The mix', pg('mix'))}{hh('Five posts', 'a week.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">People come for answers, <b>so two of the five answer a question.</b></p>
</div>
<div class="g4 mt-auto cardrow">{cols}</div>'''
    return slide('mix', 'The idea · the mix', body,
                 src='Feed posts a week on @birlafertility. Stories run daily, a Live runs monthly, and Sunday stays quiet. Mask360’s proposal.')


FEED = [  # the nine latest posts on Saturday 26 December: date, series, format, cover line, cloth (kind, seed, dark text)
    ('Sat 26 Dec', 'The Good News Question', 'carousel', 'Ask me about the wedding food', ('blush', 51, True)),
    ('Fri 25 Dec', 'A Cycle, Explained', 'carousel', 'A cycle in six frames', ('petal', 52, True)),
    ('Thu 24 Dec', 'Meet the Specialist', 'reel', 'Who answers your questions', ('navy', 53, False)),
    ('Tue 22 Dec', 'Myth or Fact', 'carousel', 'Five things people say about IVF', ('petal', 54, True)),
    ('Mon 21 Dec', 'The 1 a.m. Questions', 'reel', 'Can he get tested too?', ('navy', 55, False)),
    ('Sat 19 Dec', 'The Good News Question', 'carousel', 'Ask me about my trip to Goa', ('blush', 56, True)),
    ('Fri 18 Dec', 'Your First Visit', 'carousel', 'Your first visit, step by step', ('petal', 57, True)),
    ('Thu 17 Dec', 'Inside the Lab', 'reel', 'An embryologist’s first hour', ('navy', 58, False)),
    ('Mon 14 Dec', 'The 1 a.m. Questions', 'reel', 'Is it normal it’s taking this long?', ('navy', 59, False)),
]
GLYPH = {'reel': '<svg class="gl" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2 L10 6 L3 10 Z"/></svg>',
         'carousel': '<svg class="gl" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 1.5 H10.5 V8.5 M1.5 3.5 H8.5 V10.5 H1.5 Z"/></svg>'}
ICONS = ('<svg class="acts" viewBox="0 0 120 20" aria-hidden="true"><path d="M10 17 C3 12 1 9 1 6 A4.5 4.5 0 0 1 10 4 A4.5 4.5 0 0 1 19 6 '
         'C19 9 17 12 10 17 Z M34 4 H52 V14 H40 L34 18 Z M64 10 L82 3 L76 18 L73 12 Z M104 2 H116 V18 L110 13 L104 18 Z"/></svg>')


def feed():
    tiles = ''.join(f'''<div class="tile ptile{" d" if c[2] else ""}">{fab(c[0], c[1])}<div class="ov">{GLYPH[f]}<span class="t">{cover}</span></div></div>'''
                    for _, s_, f, cover, c in FEED)
    hl = ''.join(f'<span><i>{fab(k, sd)}</i>{x}</span>' for x, k, sd in (('1 a.m.', 'navy', 61), ('For him', 'blush', 62),
                                                                          ('First visit', 'petal', 63), ('The lab', 'navy', 64)))
    body = f'''<div class="g4 grow feed" style="grid-template-rows:auto 1fr">
  <div class="c12 stack-l">{lab('The grid', pg('feed'))}{hh('The grid on', 'Saturday 26 December.')}</div>
  <div class="c1 stack-l end pr" style="grid-row:2">
    <p class="lede-s">Nine posts, <b>four pillars, one promise.</b></p>
    <p class="ink2 f-s">Reels for the questions, carousels to save, and highlights for the answers people come back for.</p>
  </div>
  <div class="post c2 end" style="grid-row:2;margin-right:calc(var(--u)*1.4)">
    <div class="post-head"><span class="av">{AV}</span><span><b>birlafertility</b><span>Birla Fertility &amp; IVF</span></span></div>
    <div class="tile post-img">{fab('navy', 55)}<div class="ov">{GLYPH['reel']}<span class="t">Can he get tested too?</span></div></div>
    {ICONS}
    <p class="cap"><b>birlafertility</b> Question 02 came from your DMs. A specialist answers it in 40 seconds. Save it for later.</p>
    <p class="mono mute">Mon 21 Dec · The 1 a.m. Questions · Reel</p>
  </div>
  <div class="c34 mid" style="grid-row:1/3">
    <div class="phone" role="img" aria-label="A phone showing the @birlafertility profile and its nine latest posts">
      <div class="ph-head"><span class="av">{AV}</span><span class="hd"><b>birlafertility</b><span>All Heart. All Science. No question too quiet.</span></span></div>
      <div class="btns"><span>Follow</span><span>Message</span><span>Contact</span></div>
      <div class="hl">{hl}</div>
      <div class="pgrid">{tiles}</div>
    </div>
  </div>
</div>'''
    return slide('feed', 'The idea · the grid', body,
                 src='A mock-up of the grid. Cloth stands in for photography; series, dates and copy are Mask360’s proposal.')


def voice():
    posts = [('Reel', 'The 1 a.m. Questions', 'Still awake with this question? A specialist answers it in 40 seconds.', ('navy', 71)),
             ('Carousel', 'Myth or Fact', 'Five things people say about IVF. Our specialists checked each one.', ('blush', 72)),
             ('Stories', 'The Counsellor’s Hour', 'Ask anything tonight. A counsellor answers before 10 p.m.', ('petal', 73))]
    c = ''.join(f'''<div class="card vpost"><div class="card-h"><div class="tile vimg">{fab(k, sd)}</div><span class="mono mute">{f}</span></div>
<div class="mt-s"><p class="h4">birlafertility</p><p class="mono mute">{s}</p></div><p class="say mt-s">{b}</p></div>''' for f, s, b, (k, sd) in posts)
    rules = [('Say who answered', 'A named specialist, every time.'), ('Twenty words at most', 'Calm and short. The answer does the rest.'),
             ('Talk like a good counsellor', 'Warm, sure, and never in a hurry.')]
    r = ''.join(f'<div><span class="mn">0{i + 1}</span><p class="q">{a}</p><span class="x"></span><p class="a">{b}</p></div>' for i, (a, b) in enumerate(rules))
    body = f'''<div class="g4 grow">
  <div class="c1 stack-l pr">{lab('The voice', pg('voice'))}{hh('How the', 'feed sounds.', cls='h1 h1-s')}
    <div class="acc tight mt-auto flush">{r}</div></div>
  <div class="c24 g4 g3 stagger end">{c}</div>
</div>'''
    return slide('voice', 'The idea · the voice', body, src='Sample captions, written by Mask360. Every answer is reviewed by your specialists.')


def _idea_page(sid, no, pillar, name, meta, drawing, headline, challenge, make, extra, src):
    """A campaign page in the manner of Hanza's case studies: the meta rows, the name, the line, the challenge and what we make."""
    kv = ''.join(f'<div><span class="k">{k}</span><span class="v">{v}</span></div>' for k, v in [('Pillar', pillar)] + meta)
    body = f'''<div class="g4 grow">
  <div class="pic c12" style="margin-right:calc(var(--u)*2)">{drawing}<div class="ov"><span class="no">{no} · Concept drawing</span>{dots(int(no[-1]))}</div></div>
  <div class="c34 stack-l idea-body">
    <div class="kv">{kv}</div>
    <h2 class="idea-name{" long" if len(name) > 14 else ""}">{name}</h2>
    <p class="lede-s">{headline}</p>
    <p class="ink2"><b>The challenge.</b> {challenge}</p>
    <p class="ink2"><b>What we make.</b> {make}</p>
    {extra}
  </div>
</div>'''
    return slide(sid, f'The idea · {name}', body, src=src)


def _posts(drawing, caption):
    return f'''<div class="g4 g2 mt-auto" style="align-items:end">
  <div class="art phones">{drawing}</div>
  <div class="rule-plan"><p class="mono mute">Sample caption</p><p class="say mt-s" style="font-size:calc(var(--u)*1.15)">{caption}</p></div></div>'''


def asked():
    return _idea_page('asked', 'No. 01', 'Answer', 'The 1 a.m. Questions',
                      [('Format', 'Reel · Short · carousel'), ('Cadence', 'Every Monday'), ('Where', 'Instagram · YouTube · WhatsApp')],
                      art.night(), 'Asked at night, <b>answered in daylight.</b>',
                      'Fertility worries get typed into a phone late at night, alone, and land on forums and fear.',
                      'A named specialist answers one real question per post, in under a minute, filmed in daylight.',
                      _posts(art.asked_posts(), 'Question 01 came from your DMs. A specialist answers it in 40 seconds.'),
                      'Concept drawings. Questions come from comments, DMs, search and your front desks; every answer passes medical review.')


QUESTIONS = [  # no, question, format, cloth (kind, seed, dark text)
    ('Q 01', 'Is it normal that it’s taking us more than a year?', 'Reel, 45 seconds', ('petal', 81, True)),
    ('Q 02', 'Can he get tested too?', 'Reel with a male fertility specialist', ('navy', 82, False)),
    ('Q 03', 'What does my AMH number actually tell me?', 'Carousel, six frames', ('blush', 83, True)),
    ('Q 04', 'Is IVF our only option?', 'Instagram Live, monthly', ('navy', 84, False)),
]


def questions():
    cells = ''.join(f'''<div class="post-card"><div class="pc-h"><span class="mono"><span class="k">Question</span>{n[2:]}</span>{dots(i + 1, 4)}</div>
<div class="pic-t">{tile(c[0], c[1], 'The 1 a.m. Questions', q, dark_text=c[2], cls='fill qt')}</div>
<div class="pc-b"><p class="lab">{f}</p><p class="ink2">Answered by a named specialist, reviewed before it posts.</p></div></div>'''
                    for i, (n, q, f, c) in enumerate(QUESTIONS))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('Month one', pg('questions'))}{hh('Month one,', 'in the feed.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">Four questions people ask, <b>each answered by a named specialist.</b></p>
</div>
<div class="g4 mt-auto cardrow">{cells}</div>'''
    return slide('questions', 'The idea · month one', body, src='Mock covers. Answers are written with your specialists and approved before the shoot.')


def half():
    return _idea_page('half', 'No. 02', 'Belong', 'Half the Story',
                      [('Format', 'Creator series · Live · film'), ('Cadence', 'Fortnightly, from January'), ('Where', 'Two cities first')],
                      art.chairs(), 'Up to half the cases involve him. <b>Half the story is his.</b>',
                      'Fertility is still spoken of as her journey, and the tests and the stigma tend to land on her.',
                      'Men’s health creators ask the questions men keep to themselves, and a male fertility specialist answers.',
                      _posts(art.half_posts(), 'Part 01: a creator asks, a specialist answers. Thursday, 8 p.m., a Live for men only.'),
                      'Concept drawings. Male factors in 40 to 50% of cases: ISAR. Creators are paid a flat fee and give no medical advice.')


def goodnews():
    return _idea_page('goodnews', 'No. 03', 'Belong', 'The Good News Question',
                      [('Format', 'Sticker packs · film · Live'), ('Cadence', 'The wedding season'), ('Where', 'Instagram · WhatsApp')],
                      art.group(), '“Good news kab?” <b>A kinder answer.</b>',
                      'The question comes up at every wedding and festival, and for a couple who is trying it lands in front of everyone.',
                      'Warm, funny “Ask me about…” stickers, a short film where a favourite aunt learns a new question, and a counsellor-led Live.',
                      _posts(art.goodnews_posts(), 'Forward this to the family group. Then ask about the wedding food.'),
                      'Concept drawings. Runs through the wedding season, December to February.')


def voices():
    cols = [('Your specialists', 'Named, filmed in daylight, one question each.'),
            ('Your counsellors', 'The question box at night, and words for hard days.'),
            ('Men’s health creators', 'They ask the questions men keep to themselves.'),
            ('Family creators', 'They carry the sticker drop into the wedding season.')]
    c = ''.join(f'''<div class="post-card ppl"><div class="pc-h"><span class="mono"><span class="k">0{i + 1}</span>{a}</span>{dots(i + 1, 4)}</div>
<div class="art">{art.people(i)}</div><div class="pc-b"><p class="h3">{a}</p><p class="ink2">{b}</p></div></div>''' for i, (a, b) in enumerate(cols))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The voices', pg('voices'))}{hh('The people who', 'speak on the feed.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">Creators are paid a flat fee and never give medical advice. <b>Your specialists answer.</b></p>
</div>
<div class="g4 mt-auto cardrow">{c}</div>'''
    return slide('voices', 'The idea · the voices', body, src='In line with ASCI’s influencer guidelines and the October 2026 NMC notice.')


def ch_run():
    return chapter('ch-run', '03', ('How it', 'runs.'),
                   'Four steps to the first post, a month on the feed, <b>the code, the care and the numbers.</b>',
                   ('navy', 23), ('blush', 24),
                   [(pg('steps'), 'Four steps', 'steps'), (pg('calendar'), 'A month', 'calendar'), (pg('handles'), 'The accounts', 'handles'),
                    (pg('code'), 'The code', 'code'), (pg('care'), 'The care', 'care'), (pg('measure'), 'The numbers', 'measure'),
                    (pg('mask360'), 'Mask360', 'mask360'), (pg('next'), 'Next steps', 'next')])


STEPS = [  # verb, the step, what happens
    ('Listen', 'The audit', 'We read your last 90 days of posts, comments and DMs, and gather 300 real questions. A one-page audit lands in week two.'),
    ('Agree', 'The code', 'Your medical, legal and counselling teams edit our eight rules and sign them. Nothing posts before this.'),
    ('Make', 'The shoot', 'Two shoot days with your specialists, filmed in daylight. Twenty-four answers ready before launch.'),
    ('Launch', 'Question 01', 'The first post goes live on 14 December, with the care team on every comment and DM.'),
]


def steps():
    cells = ''.join(f'''<div class="card"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span>{v}</span>{dots(i + 1, 4)}</div>
<p class="h3 mt-m">{t}</p><p class="ink2">{d}</p></div>''' for i, (v, t, d) in enumerate(STEPS))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('Four steps', pg('steps'))}{hh('Four steps', 'to the first post.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">From the first meeting to Question 01, <b>the process stays simple and clear.</b></p>
</div>
<div class="g4 mt-auto cardrow">{cells}</div>'''
    return slide('steps', 'How it runs · four steps', body, src='Dates assume a start on Monday 16 November 2026.')


# a month on the feed: the weekly series from launch day (a Answer, b The Science, c Reassure, d Belong), then the one-offs;
# e marks the set-up before launch
LAUNCH = dt.date(2026, 12, 14)
WEEKLY = {0: [('a', 'The 1 a.m. Questions')], 1: [('a', 'Myth or Fact')], 2: [('c', 'The Counsellor’s Hour')], 3: [('b', 'Inside the Lab')],
          4: [('c', 'Your First Visit')], 5: [('d', 'The Good News Question')], 6: []}
SPECIAL = {dt.date(2026, 12, 2): [('e', 'Set-up: the code, signed')],
           dt.date(2026, 12, 3): [('e', 'Set-up: shoot day 1')],
           dt.date(2026, 12, 4): [('e', 'Set-up: shoot day 2')],
           dt.date(2026, 12, 9): [('e', 'Set-up: care team trained')],
           dt.date(2026, 12, 14): [('a', 'Launch: Question 01')],
           dt.date(2026, 12, 19): [('d', 'Good News: the sticker drop')],
           dt.date(2026, 12, 24): [('b', 'Meet the Specialist')],
           dt.date(2026, 12, 25): [('c', 'A Cycle, Explained')],
           dt.date(2027, 1, 2): [('d', 'Good News: wedding season')]}


def calendar():
    start = dt.date(2026, 11, 30)  # the Monday before 1 December
    head = ''.join(f'<span class="wd">{d}</span>' for d in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'))
    cells = []
    for i in range(35):
        day = start + dt.timedelta(days=i)
        tags = SPECIAL.get(day, WEEKLY[day.weekday()] if day >= LAUNCH else [])
        cls = 'day'
        if day in SPECIAL:
            cls += ' tent'
        elif day.month != 12:
            cls += ' out'
        if day.month != 12:
            cls += ' nm'
        elif day > LAUNCH + dt.timedelta(days=6):
            cls += ' rep'  # a weekly repeat, folded away on phones
        t = ''.join(f'<span class="tag {k}">{x}</span>' for k, x in tags)
        wd = f'{day:%a}' if day.month == 12 else f'{day:%a} · {day:%b}'
        cells.append(f'<div class="{cls}"><span class="n" data-wd="{wd}">{day.day}</span>{t}</div>')
    key = ''.join(f'<span class="tag label {k}">{n}</span>' for k, n in (('a', 'Answer'), ('b', 'The Science'), ('c', 'Reassure'), ('d', 'Belong')))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('A month', pg('calendar'))}{hh('December', 'on the feed.')}</div>
  <div class="c34 end stack" style="align-items:flex-end"><div class="cal-key">{key}</div>
    <p class="mono mute"><span style="display:inline-block;width:calc(var(--u)*1.2);height:2px;background:var(--accent);vertical-align:middle"></span>&ensp;Pink rule: a one-off day</p></div>
</div>
<div class="cal mt-m">{head}{''.join(cells)}</div>
<p class="cal-note ink2">The weekly series repeat all month from 14 December. Sundays stay quiet: replies only.</p>'''
    return slide('calendar', 'How it runs · a month', body, src='Assumes a start on 16 November 2026. Wedding-season posts follow the family calendar.')


def _handles_tree():
    items = ''.join(f'<li><b>{n}</b><span>{v}</span><em>{w}. {h}.</em></li>' for n, v, w, h in art.HANDLES)
    return f'<div class="map-tree"><p class="idea">@birlafertility · the main feed</p><div class="br"><ul>{items}</ul></div></div>'


def handles():
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The accounts', pg('handles'))}{hh('Every account', 'has one job.')}</div>
  <p class="lede-s c4 end">One voice book for every account. <b>Each city gets its own language.</b></p>
</div>
<div class="map mt-s">{art.handles_map()}{_handles_tree()}</div>'''
    return slide('handles', 'How it runs · the accounts', body, src='Centre languages to confirm with the brand team. Roles are Mask360’s proposal.')


CODE = [  # title, line
    ('Every claim is checked', 'Medical lines come from a named specialist and pass review.'),
    ('Hope, told honestly', 'No guarantees, no success-rate headlines, no “best”.'),
    ('Both partners, always', 'We name factors and never blame a partner.'),
    ('Every path counts', 'For people trying, freezing eggs, or still deciding.'),
    ('Testimonials stay out', 'No patient success stories, per the October 2026 NMC notice.'),
    ('Hard days, planned for', 'Mother’s Day and festive “good news” get a quieter calendar.'),
    ('Real, calm imagery', 'Real rooms and warm light. No AI-made patients.'),
    ('Words that comfort', 'We retire “failed” and “barren”, and write like a counsellor talks.'),
]


def code():
    def row(part, off):
        return ''.join(f'''<div class="card"><div class="card-h"><span class="mono"><span class="k">Rule</span>0{off + i + 1}</span>{dots(i + 1, 4)}</div>
<p class="h3">{t}</p><p class="ink2">{d}</p></div>''' for i, (t, d) in enumerate(part))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('The code', pg('code'))}{hh('Eight rules', 'we sign in week one.', cls='h1 h1-l')}</div>
  <p class="lede-s c4 end">Every brief, post and reply is checked against them. <b>Your teams edit and sign them first.</b></p>
</div>
<div class="mt-auto"><div class="g4 cardrow two-rows">{row(CODE[:4], 0)}</div><div class="g4 cardrow two-rows">{row(CODE[4:], 4)}</div></div>'''
    return slide('code', 'How it runs · the code', body, src='A draft for your medical, legal and counselling teams to edit and sign.')


def care():
    rows = [('Within 1 hour', 'Every DM gets a human reply, 9 a.m. to 10 p.m., seven days.'),
            ('Within 2 hours', 'Every comment is answered, or hidden and logged when it shames or misleads.'),
            ('Within 15 minutes', 'Any sign of crisis goes to a trained counsellor, with Tele-MANAS, 14416, in the reply.'),
            ('Always', 'No diagnosis in a DM. Medical questions move to Fertility Circle, 1800 123 1515, with consent.'),
            ('Every week', 'A listening report: new questions, themes, sentiment and risks.')]
    acc = ''.join(f'<div{" class=open" if i == 0 else ""}><span class="mn">0{i + 1}</span><p class="q">{a}</p><span class="x"></span><p class="a">{b}</p></div>'
                  for i, (a, b) in enumerate(rows))
    body = f'''<div class="g4 grow">
  <div class="c12 stack-l pr">{lab('The care', pg('care'))}{hh('Every comment is', 'a person on a hard day.', cls='h1 h1-l')}
    <div class="mt-auto" style="width:calc(50% + var(--u))">{stat('1 hr', 'Human reply', 'Every DM, 9 a.m. to 10 p.m., seven days a week.', '01', 1)}</div></div>
  <div class="c34 acc mid">{acc}</div>
</div>'''
    return slide('care', 'How it runs · the care', body,
                 src='Service levels are Mask360’s proposal. Our care team trains with your counsellors before launch.')


def measure():
    rows = [('Saves and shares per post', 'From Insights, against your last 30 posts'),
            ('Questions asked', 'Comments and DMs, every month'),
            ('Care response', 'DMs inside an hour, crisis flags inside 15 minutes'),
            ('Search views', 'Instagram and YouTube search, every month'),
            ('Consult enquiries from social', 'WhatsApp and centre codes, with consent')]
    acc = ''.join(f'<div{" class=open" if i == 0 else ""}><span class="mn">0{i + 1}</span><p class="q">{a}</p><span class="x"></span><p class="a">{b}</p></div>'
                  for i, (a, b) in enumerate(rows))
    body = f'''<div class="g4 grow">
  <div class="c12 stack-l pr">{lab('The numbers', pg('measure'))}{hh('Measured in', 'trust, then consults.', cls='h1 h1-l')}
    <div class="mt-auto" style="width:calc(50% + var(--u))">{stat('2×', 'Questions asked', 'Comments and DMs a month against today: a draft target, set from your data in week 2.', '01', 2)}</div></div>
  <div class="c34 acc mid">{acc}</div>
</div>'''
    return slide('measure', 'How it runs · the numbers', body,
                 src='First readout: week of 8 February 2027. Our fee never depends on patient numbers.')


def mask360():
    cards = [('Health and wellness', 'Swisse Wellness UAE: a 30-reel shoot with Blah Studio, live now'),
             ('Feeds we run', 'The Penthouse at St. Regis Mumbai · Moxy Mumbai'),
             ('Brands we have worked with', 'Dior · Ferrari India · L’Oréal · Dyson · Anantara · Atlantis The Royal')]
    c = ''.join(f'<div class="card"><div class="card-h"><span class="mono"><span class="k">0{i + 1}</span>{a}</span>{dots(i + 1, 4)}</div><p class="f-l mt-s">{b}</p></div>'
                for i, (a, b) in enumerate(cards))
    lounge = f'''<div class="card"><div class="card-h"><span class="mono"><span class="k">04</span>A lounge we built</span>{dots(4, 4)}</div>
<div class="big mt-s">530</div><p class="ink2">Tickets at ₹75,000 each: the Nexa Platinum Lounge, Lollapalooza India.</p></div>'''
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('Mask360', pg('mask360'))}<div class="m-logo" style="width:78%;margin-top:calc(var(--u)*1.4)"><svg viewBox="0 0 1632 473" role="img" aria-label="Mask360"><use href="#logo-m"/></svg></div></div>
  <h2 class="lede c34 end" style="font-size:calc(var(--u)*2.3);line-height:1.12;letter-spacing:-.025em">We run social and content for premium brands in India and the UAE.</h2>
</div>
<div class="g4 mt-auto cred">{c}{lounge}</div>'''
    return slide('mask360', 'How it runs · Mask360', body, dark=True, src='From Mask360’s own records.')


def next_steps():
    gets = ['Six draft posts for your specialists', 'The sensitivity code, drafted', 'A month on the feed, planned', 'Clear next steps']
    checks = ''.join(f'<li>{s}</li>' for s in gets)
    body = f'''<div class="g4 grow">
  <div class="c12 stack-l pr">{lab('Next steps', pg('next'))}
    <h2 class="h-display next-h"><span class="g">Ready</span> to start?</h2>
    <p class="lede-s" style="max-width:26em">Tell us the questions your front desks hear most. <b>We bring six draft posts to the first meeting.</b></p>
    <div class="mt-auto stack">
      <p class="mono"><span class="k">Founder</span>Kaavish Ramchandani</p>
      <a class="mail" href="mailto:kaavish@mask360.agency">kaavish@mask360.agency</a>
      <p class="mono"><span class="k">Phone</span>+91 959 107 5100 <span class="k" style="margin-left:1.4em">Web</span>mask360.agency · mask360.work</p>
    </div>
  </div>
  <div class="c4 cta end">
    <p class="mono">What you get</p>
    <h3 class="h2"><span class="g">From the first</span> meeting.</h3>
    <ul class="checks">{checks}</ul>
    {btn('Email Kaavish', 'Mask360', 'mailto:kaavish@mask360.agency')}
  </div>
</div>'''
    return slide('next', 'How it runs · next steps', body)


def close():
    nav = [('Your social today', 'ch-today'), ('The content map', 'mindmap'), ('The grid', 'feed'), ('The campaigns', 'asked'),
           ('A month', 'calendar'), ('The code', 'code'), ('Next steps', 'next'), ('Sources', 'sources')]
    n = ''.join(f'<li><a href="#{i}">{t}</a></li>' for t, i in nav)
    body = f'''<div class="g4">{WORDMARK}<p class="lab c3"><span>Thank you</span></p></div>
<div class="g4 grow" style="grid-template-rows:1fr auto;row-gap:calc(var(--u)*2.4)">
  <ul class="nav c3 end">{n}</ul>
  <div class="c4 end stack">
    <h2 class="lede-s">No question <b>too quiet.</b></h2>
    <a class="mail" href="mailto:kaavish@mask360.agency" style="font-size:calc(var(--u)*1.6)">kaavish@mask360.agency</a>
    <p class="mono"><span class="k">Phone</span>+91 959 107 5100</p>
  </div>
  <div class="giant c12 end" style="grid-row:2"><svg viewBox="0 0 1632 473" role="img" aria-label="Mask360"><use href="#logo-m"/></svg></div>
  <p class="mono c3 end" style="grid-row:2"><span class="k">©</span>2026 Mask360<br><span class="k">For</span>Birla Fertility &amp; IVF</p>
  <p class="mono c4 end" style="grid-row:2"><span class="k">October</span>2026<br><span class="k">Status</span>Confidential</p>
</div>'''
    return slide('close', 'Birla Fertility &amp; IVF × Mask360', body, bare=True, dark=True, cls='close scrim', cloth=('navy', 11))


def sources():
    items = ''.join(f'<div><p class="lab"><span class="mn">0{i + 1}</span><span>{h}</span></p><p class="f-s ink2 mt-s">{t}</p></div>'
                    for i, (h, t) in enumerate(SOURCES))
    body = f'''<div class="g4">
  <div class="c12 stack-l">{lab('Appendix', pg('sources'))}{hh('Every number,', 'and where it came from.', cls='h1 h1-s')}</div>
</div>
<div class="srcs mt-auto">{items}</div>'''
    return slide('sources', 'Appendix · sources', body)


def slides():
    out = [cover(), promise(), brief(), ch_today(), today(), channels(), rivals(), law(), rule(), insight(), ch_idea(), mindmap(),
           mix(), feed(), voice(), asked(), questions(), half(), goodnews(), voices(), ch_run(), steps(), calendar(), handles(),
           code(), care(), measure(), mask360(), next_steps(), close(), sources()]
    assert [s.split('id="', 1)[1].split('"', 1)[0] for s in out] == ORDER, 'ORDER is out of step with the slides'
    return out
