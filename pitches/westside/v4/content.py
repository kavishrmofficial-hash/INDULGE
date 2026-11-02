"""Slide copy for the proposal, as a pitch in six chapters: Westside today, the opportunity, the three ideas, the numbers,
the test, Mask360. Each content slide is a headline that makes a point, a line on why it matters to Westside, then the
facts or the plan. Supporting material sits with the idea it supports (the reference clips in Idea 1, the line-by-line
model in chapter 04); each slide carries a one-line source, and all sources are on the last page. Facts come from research_notes/Westside proposal v4/ and the Trent documents in its
sources/ folder. The look is the v3 deck's, without its app chrome."""
import art
from data import F, LAST12_SHORT, POSITIONING, MODEL, BASELINE, REF_GROUPS, LINES, PAID
from kit import slide, chapter, stat, ul, table, months, tile, photo, video_card, W_MARK, M_MARK

TITLE = 'Westside × Mask360'
DESCRIPTION = ('Mask360’s proposal to Westside, October 2026: Styled by Westside, the Westside Coffee Cart and Window Stories, '
               'measured on footfall per store.')

# drinks named after Westside labels with 2025-26 evidence (westside.com, Trent filings, trade press)
MENU = ['Bombay Paisley Filter', 'Nuon Cold Brew', 'Gia Hazelnut Latte', 'E.T.A Flat White', 'Utsa Masala Chai', 'Vark Rose Cardamom']

# the chapters, each with the conclusion that opens it (also the contents page)
CHAPTERS = [('01', 'Westside today', 'Westside grows by opening stores. We found none of its marketing counted in store visits.', ('slate', 51)),
            ('02', 'The opportunity', 'Sales happen in stores, so every post should end in one, with a code counted at billing.', ('kohl', 52)),
            ('03', 'The three ideas', 'Three ideas target 15&nbsp;mn impressions, and each one ends in a Westside store.', ('indigo', 53)),
            ('04', 'The numbers', 'The 15&nbsp;mn is built line by line. The result is read in footfall and bills.', ('denim', 54)),
            ('05', 'The test', 'One city for twelve weeks. You pay our fee only if the numbers move.', ('shaadi', 55)),
            ('06', 'Mask360', 'One team makes, runs and measures the work. Next, choose the first city.', None)]

# one cloth per month on the twelve-month strip: (kind, seed, light cloth so the month is set in ink?)
MONTH_CLOTH = [('shaadi', 11, False), ('rani', 12, False), ('bone', 13, True), ('slate', 14, False), ('denim', 15, False), ('linen', 16, True),
               ('moss', 17, False), ('ivory', 18, True), ('indigo', 19, False), ('bone', 20, True), ('mehendi', 21, False), ('kohl', 22, False)]
# the three ideas' cloth: (kind, seed, dark text?)
IDEA_CLOTH = {'styling': ('chikankari', 31, True), 'cart': ('kohl', 32, False), 'windows': ('slate', 33, False)}

# the cart renders the team made (media/out/cart-*.webp): file, name, one line, crop focus
CARTS = [('cart-ape.webp', 'Three-wheeler', 'Sage and cream, open on one side', '0% 50%'),
         ('cart-van.webp', 'Vintage van', 'Two hatches and a pastry counter', '30% 50%'),
         ('cart-awning.webp', 'Cream cart', 'Scalloped awning, brass wheel', '100% 50%'),
         ('cart-kiosk.webp', 'Green kiosk', 'Towable, fits a mall forecourt', '50% 50%')]

# full sources, on the last page; each slide carries a short version
SOURCES = [
    ('Westside today', 'Trent store update, Q2 FY26 (261 stores); Trent Q1 FY27 investor presentation, 6 Aug 2026 (301 stores, 97 cities, online over 6%, '
     'like-for-like); Q2 FY27 business update, 5 Oct 2026, as reported by Upstox (+10 stores, Trent revenue +23%); Trent Q2 FY26 investor presentation '
     '(WestStyleClub 19 mn+); Bloomberg interview with Shailina Parti, 20 Jul 2026, as reported by Retail Insight Network (400–500 designs a week).'),
    ('The last twelve months', POSITIONING['year_src'].replace('Sources: ', '')),
    ('How Westside talks', POSITIONING['voice_src'].replace('Sources: ', '')),
    ('The market', 'Shoppers Stop Q1 FY27 results release, 22 Jul 2026; Passionate in Marketing, 4 May 2026 (Trends); FashionUnited, 30 Apr 2026, and '
     'Fibre2Fashion (H&amp;M); Retail4Growth, 13 Apr 2026, and Indian Retailer, 9 Oct 2026 (Uniqlo); IndianTelevision, 23 Sep 2026 (Myntra); '
     'Social Samosa, 6 Oct 2025 (Pantaloons); The Week, 20 Aug 2025 (Max).'),
    ('What we found', 'Trent Q1 FY27 deck (online over 6%); Trent Q4 FY26 deck (YNG); Retail Insight Network, 20 Jul 2026 (designs); our review of Trent '
     'filings, decks and press to 16 Oct 2026. Westside’s Instagram feed is not yet reviewed.'),
    ('The ideas and the numbers', BASELINE['src'] + ' ' + MODEL['src']),
    ('Styled by Westside', 'Designs: Bloomberg interview with Shailina Parti, 20 Jul 2026, as reported by Retail Insight Network. Own labels: BW Businessworld, '
     '2026. Featured looks use lines with stock depth, signed off by Westside’s buying team.'),
    ('The Westside Coffee Cart', 'Menu names use Westside’s own labels (westside.com, Trent filings and trade press, 2025–26). About 300 cups a cart day is a '
     'planning figure to confirm with a coffee partner, who runs the bar under its own food licence; every site needs mall or landlord consent. '
     'Cart images are concept renders.'),
    ('Window Stories', 'Rollout is a planning figure to confirm with Westside’s VM team. Character names are working titles.'),
    ('Measurement', 'One store on its own needs a lift of about 8–15% to read clearly; pooling a city’s stores lets us read smaller lifts. A launch store is '
     'read against the opening weeks of recent comparable openings. We see store totals only, never personal data.'),
]


def _mn(x):
    return f'{x / 1e6:.1f}'


def _range(k):
    lo, _, hi = MODEL['by_idea'][k]
    return f'range {_mn(lo)} to {_mn(hi)}&nbsp;mn'


def _head(title, lede):
    """The standard header: a headline that makes a point on the left, why it matters on the right."""
    return f'<div class="row c-7-5 top"><h2 class="h1">{title}</h2><p class="ink2 lede-s">{lede}</p></div>'


def _blk(label, text):
    return f'<div class="blk"><span class="label">{label}</span><p>{text}</p></div>'


# ---------------------------------------------------------------- front
def cover():
    body = f'''<div class="stack-l grow" style="justify-content:space-between">
<div class="big-wm" aria-label="Westside">{W_MARK}<span class="t" aria-hidden="true">Westside</span></div>
<div class="cover-foot">
  <div class="stack-l">
    <span class="label">A proposal from Mask360 · October 2026</span>
    <h1 class="h-display" style="max-width:11em">From the post to the billing counter.</h1>
    <p class="lede" style="color:inherit;opacity:.86">Styled by Westside, the Westside Coffee Cart and Window Stories, each judged on footfall per store.</p>
  </div>
  {M_MARK}
</div></div>'''
    return slide('cover', 'Proposal', body, src='For the Westside leadership team, Trent Limited · Confidential', bare=True, dark=True, cls='cover scrim', cloth=('slate', 7))


def promise():
    body = '''<div class="stack-l grow" style="justify-content:center">
<h2 class="q">We will take shoppers from the post to the <u>billing counter</u>.</h2>
<p class="lede">Every idea here ends inside a Westside store and is judged on how many more people walk in. Together the three ideas target 15&nbsp;mn impressions in twelve weeks.</p>
</div>
<div class="terms">
  <div><span class="no label">01</span><p class="h3">Test it once</p><p class="mt-s ink2">One city for twelve weeks, built around a store launch or the wedding season.</p></div>
  <div><span class="no label">02</span><p class="h3">Measure it your way</p><p class="mt-s ink2">Your footfall and your bills, read against stores that did not get the programme.</p></div>
  <div><span class="no label">03</span><p class="h3">No result, nothing to pay</p><p class="mt-s ink2">If the numbers don’t move, you lose nothing.</p></div>
</div>'''
    return slide('promise', 'Our promise', body)


def contents():
    rows = ''.join(f'<div class="r"><span class="n">{n}</span><span class="t">{t}</span><span class="l ink2">{line}</span></div>' for n, t, line, _ in CHAPTERS)
    rows += '<div class="r app"><span class="n"></span><span class="t">Sources</span><span class="l">Every source behind the numbers, on the last page.</span></div>'
    body = f'''<div class="stack-l grow">
<h2 class="h1">The proposal in six parts.</h2>
<div class="toc grow v-center">{rows}</div>
</div>'''
    return slide('contents', 'Contents', body)


def opener(i):
    n, t, line, cloth = CHAPTERS[i]
    return chapter(f'ch{n}', n, t, line, cloth)


# ---------------------------------------------------------------- 01 Westside today
def today():
    s = F
    body = f'''<div class="stack-l grow">
{_head('Westside’s next gain is more people in each store.', 'Like-for-like growth in Trent’s fashion portfolio was in low single digits from April to June 2026, so growth is coming mainly from new stores.')}
<div class="board grow" style="align-content:center;align-self:stretch">
  {stat(s['stores'], 'stores on 30&nbsp;Sep&nbsp;2026', f"{s['stores_added']} more than a year earlier")}
  {stat(s['cities'], 'cities', '30 June 2026, the latest count')}
  {stat(s['members'], 'WestStyleClub members', '30 Sep 2025, the latest confirmed')}
  {stat(s['online'], 'of Westside revenue is online', 'April to June 2026; the rest is spent in stores')}
  {stat(s['growth'], 'Trent revenue, Jul–Sep 2026', 'Trent standalone, not Westside alone')}
  {stat('400–500', 'new designs a week', 'as reported, July 2026')}
</div></div>'''
    return slide('today', '01 · Westside today · The business', body, src='Sources: Trent filings and press reports, 2025–26. Full list on the last page.')


def year():
    items = [(m, f'<b>{t}</b>' if t else line, line if t else '', quiet, MONTH_CLOTH[i]) for i, (m, t, line, quiet) in enumerate(LAST12_SHORT)]
    noticed = [('Busiest', 'February to July, a Wesness event almost every month.'), ('Least visible', 'Store openings. We found almost no launch communication.'),
               ('Not reported', 'Footfall, for any campaign we found.')]
    cols = ''.join(f'<div class="rule"><p class="h4">{a}</p><p class="ink2 mt-s">{b}</p></div>' for a, b in noticed)
    body = f'''<div class="stack-l grow">
{_head('Westside spent the year building communities.', 'It held Wesness runs, grew YNG, launched FRONT ROW and put festive edits on westside.com. These communities are people Westside can bring into its stores.')}
{months(items)}
<div class="stack"><p class="label mute">What we noticed</p><div class="row c3">{cols}</div></div>
</div>'''
    return slide('year', '01 · Westside today · The last twelve months', body,
                 src='Sources: Trent decks and releases, trade press, westside.com. “No campaign found” means none in those sources; Instagram not yet reviewed.')


def voice():
    says = ['<b>New Indian talent.</b> YNG creators, 30 New Faces, FRONT ROW.', '<b>Culture beyond clothes.</b> I-pop, dance-offs, fitness runs.',
            '<b>Women together.</b> Wesness runs in four cities.', '<b>Own labels first.</b> Bombay Paisley, E.T.A, Utsa, Vark, W Edit.']
    take = ['Show shoppers the 400–500 new designs a week, store by store.', 'Tell one wedding-season story, in the windows and on Instagram.',
            'Give every new store the same local launch, styled from its rails.', 'End every post and every event in a store, and count the visit.']
    body = f'''<div class="stack-l grow">
{_head('Westside’s everyday voice is warm, and its events are editorial.', 'Four themes run through both, but we found nothing that takes people from a post or an event into a store.')}
<div class="row c2 grow vc">
  <div class="rule stack"><p class="label mute">What Westside says now</p>{ul(says, 'list big-list')}</div>
  <div class="rule-plan stack"><p class="label">Where we take it</p>{ul(take, 'list big-list')}</div>
</div></div>'''
    return slide('voice', '01 · Westside today · How Westside talks', body, src='Sources: Trent investor presentations, Indian Retailer, westside.com.')


RIVALS = [  # condensed from data.COMPETITORS (the full rows and their sources are in research note 04)
    ('Shoppers Stop', '115 dept. stores', 'Wedding, travel and HYBE campaigns', 'Own labels, so every look is stocked in a named store'),
    ('Max Fashion', 'Landmark Group', 'Star films selling weekly newness', 'Real looks, styled and stocked in a named store'),
    ('Pantaloons', 'ABFRL', 'A first star ambassador', 'Local stylists and creators, each tied to a store'),
    ('Trends', 'Reliance Retail', 'Spend ₹1,499, enter a holiday contest', 'No discounts or contests. People come for the looks'),
    ('H&amp;M', '71 stores, Apr 2026', 'HYBE pop-ups in six cities', 'Runs on Westside’s calendar and ends in its stores'),
    ('Uniqlo', 'Uniqlo India', 'New stores, a star fleece campaign', 'Every new store gets a local launch'),
    ('Myntra', 'online only', 'Creator School, triple festive earnings', 'Every creator post counted at billing'),
]


def market():
    rows = [[f'<b>{n}</b><br><span class="mute f-s">{s}</span>', d, w] for n, s, d, w in RIVALS]
    body = f'''<div class="stack-l grow">
{_head('Rivals ran star campaigns and contests. Westside can win in its own stores.', 'Their shoppers differ, but often spend from the same budget. Westside’s edge is its own labels in 311 stores.')}
<div class="grow v-center">{table(['Brand', 'What they did', 'How Westside wins'], rows, cls='tbl rivals stackable')}</div>
</div>'''
    return slide('market', '01 · Westside today · The market', body, src='Sources: company releases and trade press, Aug 2025 to Oct 2026. Full list on the last page.')


# ---------------------------------------------------------------- 02 The opportunity
def insight():
    cols = [('6%+', 'of Westside revenue is online, April to June 2026. The rest is spent in its stores.'),
            ('6&nbsp;mn', 'YNG views, January to March 2026, Westside’s biggest published content figure of the year.'),
            ('400–500', 'new designs a week, as reported in July 2026. We found that pace told only to investors and press.')]
    c = ''.join(f'<div class="rule">{stat(n, "")}<p class="ink2 mt-s">{t}</p></div>' for n, t in cols)
    body = f'''<div class="stack-l grow" style="justify-content:center">
<h2 class="q q-s">Westside’s sales happen in its stores. Its marketing is counted in views and turnout.</h2>
<p class="lede">No result we found counts a store visit, so nothing published yet shows which post or event brought a shopper in.</p>
</div>
<div class="row c3">{c}</div>'''
    return slide('insight', '02 · The opportunity · What we found', body,
                 src='Sources: Trent Q1 FY27 and Q4 FY26 decks; Retail Insight Network, 20 Jul 2026; our review of filings and press to 16 Oct 2026.')


def look_code():
    steps = [('Made in store', 'Built from one store’s rails.'), ('Posted that week', 'On Westside, creator and city pages.'),
             ('Tagged with a code', 'On every post, cup sleeve and window card.'), ('Shown at the store', 'The team brings the look in your size.'),
             ('Logged at billing', 'Matched to member bills by Westside’s analysts.')]
    cells = ''.join(f'<div><span class="dot label">{i + 1:02d}</span><p class="h3">{a}</p><p class="ink2 mt-s">{b}</p></div>' for i, (a, b) in enumerate(steps))
    body = f'''<div class="stack-l grow">
{_head('One look code takes a shopper from the post to the billing counter.', 'The code tells the store team which look you want and tells us which post brought you in, so Westside can see what marketing adds to each store.')}
<div class="row c5 flow vc grow">{cells}</div>
<p class="rule ink2">The code is never a discount. Store teams get one short briefing a week on the looks and how to log the code.</p>
</div>'''
    return slide('look-code', '02 · The opportunity · The look code', body)


# ---------------------------------------------------------------- 03 The three ideas
def ideas():
    rows = [('No. 01', 'Styled by Westside', 'Stylists and creators build looks in store every week, each with a code.', 'Builds on YNG’s creators and the weekly new designs.', MODEL['styling'], IDEA_CLOTH['styling']),
            ('No. 02', 'The Westside Coffee Cart', 'Drinks named after Westside labels, with a look code on every cup.', 'Builds on Wesness, which already starts runs at Westside stores.', MODEL['cart'], IDEA_CLOTH['cart']),
            ('No. 03', 'Window Stories', 'Two mannequins in a story, with every piece sold inside.', 'Builds on FRONT ROW’s New Faces, cast in the window Reels.', MODEL['windows'], IDEA_CLOTH['windows'])]
    cols = ''.join(f'''<div class="idea">{tile(c[0], c[1], n, t, dark_text=c[2])}<p class="idea-d">{d}</p>
<div class="rule"><p class="ink2">{b}</p></div><div class="imp">{m['label']}<small>impressions</small></div></div>''' for n, t, d, b, m, c in rows)
    body = f'''<div class="stack-l grow">
{_head('Each idea builds on something Westside already runs.', f"Together they target {MODEL['total_label']} impressions in one city over twelve weeks. We commit to beat Westside’s best comparable campaign of the last year by at least 20%.")}
<div class="row c3 grow vc">{cols}</div>
</div>'''
    return slide('ideas', '03 · The three ideas · Overview', body, src='Baseline: Trent Q4 FY26 deck (YNG). Plan: the model in chapter 04.')


def styling():
    formats = [('One piece, three ways', 'From office to dinner to a family function.'), ('Style me for…', 'A creator brings a real occasion.'),
               ('Head to toe, one budget', 'Clothes, shoes and Studiowest make-up, with the total on screen.'), ('Stylist vs creator', 'Same brief, and the audience picks.')]
    f = ''.join(f'<div><p class="h4">{a}</p><p class="ink2 f-s mt-s">{b}</p></div>' for a, b in formats)
    body = f'''<div class="row c-6-6 grow">
<div class="pic">{art.rail(highlight='saree', code='LOOK 027')}<div class="ov"><span class="no">No. 01</span><span class="label">Concept drawing</span></div></div>
<div class="stack-l ideap">
  <span class="label">Styled by Westside</span>
  <h2 class="h1">Make styling the reason people follow Westside.</h2>
  <p class="ink2">Almost everything Westside sells is its own label, and its designers create 400–500 new designs a week. Most shoppers never see how those pieces go together.</p>
  {_blk('What it is', 'Every week our stylists and YNG creators build complete looks from one Westside store, film them on the shop floor and post them.')}
  {_blk('How it ends in a store', 'You see one saree styled three ways, every piece from your nearest Westside. You show its code, LOOK 027, in store, and the team brings the whole outfit in your size.')}
  <div class="spec">{f}</div>
</div>
</div>'''
    return slide('styling', '03 · Idea 1 of 3', body, src='Designs as reported by Retail Insight Network, 20 Jul 2026. Own labels: BW Businessworld, 2026. Drawing is a concept.')


def _plan_stats(m, k, people_label, people_note=''):
    return (f'<div class="stack-l"><div class="rule">{stat(m["label"], "impressions", _range(k))}</div>'
            f'<div class="rule">{stat(m["people"], people_label, people_note)}</div></div>')


def styling_plan():
    m = MODEL['styling']
    rows = [['Stylists', '3', 'every week'], ['Shoot days, on the shop floor', '24', '2 a week'], ['Creator Reels, YNG members first', '40', '3 to 4 a week'],
            ['Clip and city page posts', '55', '4 to 5 a week'], ['Westside Reels', '36', '3 a week'], ['Crew visits to stores, two per shoot day', '48', '4 a week']]
    body = f'''<div class="stack-l grow">
{_head('Three stylists make 120 coded looks in twelve weeks.', 'That is ten complete looks a week, each filmed on the shop floor and tagged to its rail. These are the numbers we commit to.')}
<div class="row c-7-5 grow vc">
  {table(['Item', 'How many', 'How often'], rows, cls='tbl roomy stackable', right=(1,))}
  {_plan_stats(m, 'Styled by Westside', 'people from Mask360', m['people_note'])}
</div></div>'''
    return slide('styling-plan', '03 · Idea 1 of 3 · The plan', body, src='Mask360’s plan for the twelve-week test. Impressions from the model in chapter 04.')


def cart():
    menu = ''.join(f'<li>{x}</li>' for x in MENU)
    body = f'''<div class="row c-6-6 grow">
<div class="pic ph">{photo('cart-at-store.webp', 'Concept render: a green Westside coffee cart at the entrance of a Westside store', pos='28% 50%')}<div class="ov"><span class="no">No. 02</span><span class="label">Concept render</span></div></div>
<div class="stack-l ideap">
  <span class="label">The Westside Coffee Cart</span>
  <h2 class="h1">Every cup from the cart carries a look to try on in store.</h2>
  <p class="ink2">The cart goes where people already gather, from Westside forecourts to malls and colleges, with Westside’s labels on the menu. City and food pages film it, so people who never pass it still see it.</p>
  {_blk('What it is', 'A Westside-designed coffee cart outside Westside stores, in malls, at colleges and in office parks. A coffee partner sells at café prices, with no free cups.')}
  {_blk('How it ends in a store', 'You order a Nuon Cold Brew outside the store. The sleeve carries a look code, and inside the team brings the look in your size.')}
  <div class="rule-plan"><p class="label">On the menu</p><ul class="list mt-s menu-2">{menu}</ul></div>
</div>
</div>'''
    return slide('cart', '03 · Idea 2 of 3', body, src='Menu names use Westside’s own labels. Image is a concept render.')


def cart_designs():
    cards = ''.join(f'<figure class="shot">{photo(f, f"Concept render: {t.lower()}, a Westside coffee cart", pos=pos)}'
                    f'<figcaption><span class="label">No. {i + 1:02d} · {t}</span><span class="f-s mute">{d}</span></figcaption></figure>'
                    for i, (f, t, d, pos) in enumerate(CARTS))
    body = f'''<div class="stack-l grow">
{_head('The cart can be built four ways, all in Westside’s look.', 'We choose one design with Westside’s brand team and build three carts in it, one for each site, with the W on the front.')}
<div class="shots grow">{cards}</div>
</div>'''
    return slide('cart-designs', '03 · Idea 2 of 3 · The designs', body, src='Concept renders by the Mask360 team.')


def cart_plan():
    m = MODEL['cart']
    rows = [['Carts', '3', 'One per site in the test city'], ['Cart days', '72', 'Thursday to Sunday, six weeks'], ['Cups', '21,600', 'Sold at café prices, each with a look code'],
            ['Creator Reels', '30', 'From the queue, the cup and the store'], ['Clip, city and food page posts', '76', 'Timed to cart days'],
            ['Sites', 'Every one', 'Mall or landlord consent; no public-street vending']]
    body = f'''<div class="stack-l grow">
{_head('Three carts serve 21,600 cups in six weeks.', 'A coffee partner runs the bar under its own food licence, and we run everything else, from the sites to the posts.')}
<div class="row c-7-5 grow vc">
  {table(['Item', 'How many', 'Detail'], rows, cls='tbl roomy stackable', right=(1,))}
  {_plan_stats(m, 'Coffee Cart', 'people on the cart team', m['people_note'])}
</div></div>'''
    return slide('cart-plan', '03 · Idea 2 of 3 · The plan', body, src='About 300 cups a cart day is a planning figure to confirm with the coffee partner.')


def windows():
    body = f'''<div class="row c-6-6 grow">
<div class="pic">{art.window()}<div class="ov"><span class="no">No. 03</span><span class="label">Concept drawing · 7:45 pm</span></div></div>
<div class="stack-l ideap">
  <span class="label">Window Stories</span>
  <h2 class="h1">Rahul and Anjali are getting ready for a date.</h2>
  <p class="ink2">A window that tells a familiar story gives people walking past a Westside store a reason to stop and photograph it.</p>
  {_blk('What it is', 'Two mannequins dressed for a moment everyone knows, with every piece on them for sale inside. The story changes every four weeks, and each store picks its own.')}
  {_blk('How it ends in a store', 'Each look is priced on a card in the window, with a code to ask for it in store. Anjali’s dressing table is set with Studiowest, priced on the same card.')}
  {_blk('Who is in the Reels', 'FRONT ROW’s New Faces play the couples, filmed at the window by store teams and local creators.')}
</div>
</div>'''
    return slide('windows', '03 · Idea 3 of 3', body, src='Concept drawing. Character names are working titles.')


def windows_scale():
    m = MODEL['windows']
    cloth = [('rani', 41, False), ('mehendi', 42, False), ('slate', 43, False), ('linen', 44, True), ('kohl', 45, False), ('ivory', 46, True)]
    stories = ''.join(f'<div>{tile(k, sd, f"No. {i + 1:02d}", c, dark_text=d)}<p class="f-s ink2 mt-s">{s}</p></div>' for i, ((c, s), (k, sd, d)) in enumerate(zip(m['stories'], cloth)))
    body = f'''<div class="row c-5-7 grow">
<div class="stack-l" style="justify-content:space-between">
  <h2 class="h1">Each of the 311 stores picks its own story from one library.</h2>
  <p class="ink2">We write twelve stories a quarter, and windows change every four weeks. The test city goes first; the rest follow if the readout says go.</p>
  <div class="art" style="height:auto">{art.stores_grid(n=m['grid_n'], cols=25)}</div>
  <p class="f-s ink2">One square per Westside store.</p>
</div>
<div class="stack-l" style="justify-content:space-between">
  <div class="stories">{stories}</div>
  <div class="row c3">
    <div class="rule">{stat(m['label'], 'impressions, test city', _range('Window Stories'))}</div>
    <div class="rule">{stat('60', 'Reels from the windows', 'by store teams and local creators')}</div>
    <div class="rule">{stat(m['people'], 'people', m['people_note'])}</div>
  </div>
</div></div>'''
    return slide('windows-scale', '03 · Idea 3 of 3 · At scale', body, src='Rollout to confirm with Westside’s VM team. Impressions from the model in chapter 04.')


# ---------------------------------------------------------------- 04 The numbers
SHORT = {'Westside’s pages': 'Westside Reels', 'YNG and city creators': 'creator Reels', 'Creators at the cart': 'creator Reels',
         'Store teams and local creators': 'local Reels', 'Clip and city pages': 'page posts', 'Clip, city and food pages': 'page posts',
         'City pages': 'page posts', 'Paid Reels boost': 'boost'}


def _runs(idea):
    """What runs for one idea, from the model's own lines, e.g. '36 Westside Reels · 40 creator Reels · …'."""
    out, cur = [], ''
    for i, ch, ut, u, at, a, paid in LINES:
        cur = i or cur
        if cur == idea:
            out.append(f'{ut} boost' if paid else f'{u} {SHORT[ch]}')
    return ' · '.join(out)


def numbers():
    lo, base, hi = (sum(v[k] for v in MODEL['by_idea'].values()) for k in range(3))
    rows = [[n, _runs(k), f'<b>{_mn(MODEL["by_idea"][k][1])}</b>'] for k, n in
            (('Styled by Westside', 'Styled by Westside'), ('Coffee Cart', 'The Westside Coffee Cart'), ('Window Stories', 'Window Stories'))]
    b = BASELINE
    body = f'''<div class="stack-l grow">
{_head(f"The {MODEL['total_label']} adds up from units we commit to.", f'Each line is units times an average per unit, with a range of {_mn(lo)} to {_mn(hi)}&nbsp;mn. Posts count views, as YNG’s 6&nbsp;mn does; boosts count impressions at ₹120 per 1,000.')}
<div class="row c-7-5 grow vc">
  {table(['Idea', 'What runs', 'mn'], rows, cls='tbl roomy stackable', right=(2,), total=['Total', '', f'<b>{_mn(base)}</b>'])}
  <div class="stack-l">
    <p class="label mute">Against YNG, Jan–Mar 2026</p>
    <div class="bars">
      <div class="bar"><span class="f-s">YNG views</span><span class="t"><i style="width:{b['pct_base']}%"></i></span><span class="v">{b['value']}</span></div>
      <div class="bar us"><span class="f-s">This test</span><span class="t"><i style="width:{b['pct_plan']}%"></i></span><span class="v">{MODEL['total_label']}</span></div>
    </div>
    <p class="ink2">In week one we agree the comparable campaign we must beat by at least 20%. If post views are behind plan by week six, we move budget into the boosts.</p>
  </div>
</div></div>'''
    return slide('numbers', '04 · The numbers · Impressions', body, src='The model, line by line, is on the next page.')


def measure():
    rows = [['Footfall per store', 'Store entry counts', 'Matched stores that did not get the programme'], ['Codes used', 'Logged at billing', 'Per store, per idea, per week'],
            ['Member bills', 'WestStyleClub bills, matched by Westside’s analysts', 'Members with a code against those without'],
            ['Views and impressions', 'Platform reports', 'The plan, line by line']]
    body = f'''<div class="stack-l grow">
{_head('We judge the test on footfall per store, against stores that did not get it.', 'Impressions show the work was seen; footfall and bills show it worked. We report both every week, store by store.')}
<div class="row c-4-8 grow vc">
  <div class="board" style="grid-template-columns:1fr">{stat('5%+', 'more entries than matched stores, over the twelve live weeks', 'a draft threshold, set from your data before launch')}</div>
  <div class="stack-l">{table(['What we count', 'How', 'Read against'], rows, cls='tbl roomy stackable')}
  <p class="f-s ink2">One store on its own needs a lift of about 8–15% to read clearly, so we pool the city’s stores.</p></div>
</div></div>'''
    return slide('measure', '04 · The numbers · Measurement', body, src='We see store totals only, never personal data.')


# ---------------------------------------------------------------- 05 The test
def test():
    body = '''<div class="stack-l grow">
<h2 class="h1">Start with one city. If the numbers don’t move, you lose nothing.</h2>
<p class="ink2 lede-s">All three ideas run in one twelve-week test, read on footfall per store. You choose what the test is built around.</p>
<div class="row c2 vc grow">
  <div class="opt rec stack"><p class="label">Option A · recommended</p><h3 class="h2">A store launch</h3><p class="ink2">Your next opening and its city, with looks styled from its rails before it opens and a cart outside from opening weekend.</p></div>
  <div class="opt stack"><p class="label mute">Option B</p><h3 class="h2">The wedding season</h3><p class="ink2">One city through the wedding dates, with looks for every function and wedding Window Stories in every store.</p></div>
</div>
<div class="row c3">
  <div class="rule-plan"><p class="h4">If it works</p><p class="mt-s">You pay our fee, plus production and media up to an agreed cap.</p></div>
  <div class="rule-plan"><p class="h4">If it doesn’t</p><p class="mt-s">No fee. We carry production and media up to that cap.</p></div>
  <div class="rule-plan"><p class="h4">What we need</p><p class="mt-s">A test city, matched stores, counter and bill data, a code field at billing. We also need stock depth on featured looks and sign-off on posts within 48 hours.</p></div>
</div></div>'''
    return slide('test', '05 · The test · The offer', body)


def timeline():
    weeks = 17
    phases = [('Codes and briefings', 1, 3, 'line', 'Codes at billing and store teams briefed, after Diwali'), ('Cast and build', 2, 7, 'line', 'Stylists and creators by week 4, carts by week 6'),
              ('Styled by Westside', 5, 17, 'plan', '120 looks'), ('Coffee Cart', 7, 13, 'plan', 'Thursday to Sunday, six weeks'),
              ('Window Stories', 5, 17, 'plan', 'A new story every four weeks'), ('Readout', 17, 18, 'ink', 'Go or no&#8209;go')]
    head = ''.join(f'<span class="wk label">{i}</span>' for i in range(1, weeks + 1))
    rows = ''.join(f'<p class="h4 ph">{n}</p><i class="bar-{c}" style="grid-column:{s + 1}/{e + 1}"></i><p class="ink2 f-s note">{t}</p>' for n, s, e, c, t in phases)
    body = f'''<div class="stack-l grow">
{_head('Sign by 30 October, and the test goes live on 30 November.', 'Four weeks to set up and twelve weeks live, then a readout with your leadership and a go or no&#8209;go for the next cities.')}
<div class="gantt vc grow"><span></span>{head}{rows}</div>
<div class="row c3 dates">
  <div class="rule"><p class="label mute">Set up</p><p class="mt-s">2 to 29 November</p></div>
  <div class="rule-plan"><p class="label">Live</p><p class="mt-s">30 November to 21 February</p></div>
  <div class="rule"><p class="label mute">Readout</p><p class="mt-s">Week of 22 February 2027</p></div>
</div></div>'''
    return slide('timeline', '05 · The test · Timeline', body, src='Dates assume entry counters already in your stores, a session by 27 October and signing by 30 October.')


# ---------------------------------------------------------------- 06 Mask360
def mask360():
    pillars = [('Social', 'The Styled by Westside series, creators and paid page posts.'), ('Content', 'Stylists, shoots and edits, made in Westside stores.'),
               ('Events and retail', 'The Coffee Cart and Window Stories, built and run.'), ('Measurement', 'The per-store scorecard, built with Westside’s analysts.')]
    p = ''.join(f'<div><p class="h2">{a}</p><p class="ink2 mt-s">{b}</p></div>' for a, b in pillars)
    body = f'''<div class="stack-l grow" style="justify-content:center">
<div class="row c-7-5" style="align-items:end">
  <div class="m-logo"><svg viewBox="0 0 1632 473" aria-label="m360"><use href="#logo-m"/></svg></div>
  <div class="stack"><h2 class="h2">One team makes, runs and measures all three ideas.</h2><p class="ink2">Mask360 is a creative and content agency in India and the UAE.</p></div>
</div>
<div class="row c4 pillars mt-m">{p}</div>
<div class="rule mt-m"><p class="label mute">Brands we have worked with</p><p class="mt-s f-l">Dior · L’Oréal · FCUK Beauty · Dyson · Anantara · Atlantis The Royal · St. Regis · Ferrari · Rolls-Royce · Swisse · Zorae · Rustomjee · Chandak Group</p></div>
</div>'''
    return slide('mask360', '06 · Mask360', body, dark=True)


def next_steps():
    body = '''<div class="row c-6-6 grow" style="align-items:end">
<div class="stack-l">
  <h2 class="h-display h-next">Choose the first city.</h2>
  <p class="lede">One working session with your marketing, retail operations and analytics leads. We bring a store shortlist and a draft threshold; within 72 hours you get a fixed scope and terms.</p>
</div>
<div class="stack-l">
  <ol class="list steps"><li>Pick a store launch or the wedding season, and the city.</li><li>Share counter and bill data for the test and matched stores.</li><li>Agree the threshold, our fee and the cap.</li><li>Week one starts the Monday after you sign.</li></ol>
  <p class="h4">Meet by 27 October and sign by 30 October to go live on 30 November.</p>
  <div class="rule-plan"><p class="h3">Kaavish · Mask360</p><p class="ink2 mt-s">mask360.agency</p></div>
</div></div>'''
    return slide('next', '06 · Mask360 · Next steps', body)


def close():
    body = f'''<div class="grow" style="display:grid;place-items:center">
<div class="close-mark">
  <svg class="w" viewBox="0 0 1506 1194" aria-label="Westside"><use href="#logo-w"/></svg>
  <span class="label line">Westside × Mask360 · from the post to the billing counter</span>
  {M_MARK}
</div></div>'''
    return slide('close', 'Westside × Mask360', body, bare=True, dark=True, cloth=('ink', 11))


# ---------------------------------------------------------------- the line-by-line model (chapter 04), the reference clips (Idea 1), the sources page
def model():
    rows = MODEL['table']
    base = sum(v[1] for v in MODEL['by_idea'].values())
    body = f'''<div class="stack-l grow">
{_head('The model, line by line.', f'Posts count views ({_mn(base - PAID)}&nbsp;mn); boosts count impressions at ₹120 per 1,000 ({_mn(PAID)}&nbsp;mn). Low is 60% of post views and high is 150%; boosts are fixed. Figures in millions.')}
{table(['Idea', 'Channel', 'Units', 'Average per unit', 'Low', 'Plan', 'High'], rows['rows'], cls='tbl small tight model', right=(2, 3, 4, 5, 6), total=rows['total'], col_cls={3: 'm-hide', 4: 'm-hide', 5: 'plan-col', 6: 'm-hide'})}
</div>'''
    return slide('model', '04 · The numbers · The model', body, src=MODEL['src'])


REF_TITLES = ['The formats we would film', 'In-store moments we would film']


def references():
    """The team's reference clips, inside Idea 1: they show the look and pace of the styling content."""
    out = []
    n = len(REF_GROUPS)
    for i, (_, vids) in enumerate(REF_GROUPS):
        cards = ''.join(video_card(v['item'], v['caption'], span=v.get('span', '')) for v in vids)
        body = f'''<div class="row c-3-9 grow">
<div class="stack-l">
  <span class="label">Styled by Westside</span>
  <h2 class="h1">{REF_TITLES[i]}.</h2>
  <p class="ink2 lede-s">Clips the team collected for the look and pace of the series. They are references, not our work. Press play.</p>
</div>
<div class="vgrid two-rows vc">{cards}</div>
</div>'''
        out.append(slide(f'references-{i + 1}', f'03 · Idea 1 of 3 · References {i + 1} of {n}', body))
    return out


def sources():
    items = ''.join(f'<div><p class="label">{a}</p><p class="f-s ink2 mt-s">{b}</p></div>' for a, b in SOURCES)
    body = f'''<div class="stack-l grow">
<h2 class="h1">Sources.</h2>
<div class="srcs">{items}</div>
</div>'''
    return slide('sources', 'Sources', body, src='Full sources for every slide.')


def slides():
    return [cover(), promise(), contents(),
            opener(0), today(), year(), voice(), market(),
            opener(1), insight(), look_code(),
            opener(2), ideas(), styling(), *references(), styling_plan(), cart(), cart_designs(), cart_plan(), windows(), windows_scale(),
            opener(3), numbers(), model(), measure(),
            opener(4), test(), timeline(),
            mask360(), next_steps(), close(),
            sources()]
