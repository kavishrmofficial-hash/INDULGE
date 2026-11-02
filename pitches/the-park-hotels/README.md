# The Park Hotels × Mask360 · proposal

Prepared 17 October 2026 for Anmol Tyagi (Senior Manager, Brand, The Park Hotels), in reply to the LinkedIn call for social media agencies.

**The deck:** [The Park Hotels × Mask360](https://claude.ai/artifact/7iHP59dK2NgHFLfiwzWX4e), 31 slides with 20 reference clips. It is private until shared from the page's Share menu.

**The idea in one line:** The Park is named after a street. *Park Street, everywhere*: each THE Park hotel becomes the Park Street of its city, told through a magazine of its nights.

**The look:** the Hanza Framer template (https://hanza-template.framer.website), as asked:
- four column guides that stay visible;
- uppercase Zalando Sans headings in two tones (a grey line, then an ink line), with Geist Mono for small labels;
- one orange accent (#FF6044) for squares, rules and button ends;
- Hanza's cards, buttons, accordion rows and case-study rows;
- flat dark sections between the white ones. Every colour is flat: no gradients and no grain.

**The copy** borrows Hanza's logic within Mask360's rules: a promise in the reader's terms on the cover, two-beat headings, ledes that read as a journey, a "Sells" line on each idea page, a Quick answers page for the six questions the brand team will ask, and a low-risk "Ready to start? What you get" ask on next steps.

Flat tiles and line drawings stand in for photography. The tiles carry the pillar code used on every page: After Hours in ink, By Design in grey, The Table outlined, The City in light grey. Orange stays for the idea, the hero series and the one-off posts. The Park's corporate mark (`deck/park.svg`, from theparkhotels.com) sits in every running head and on the cover. Both fonts are open-licence (SIL OFL, notes in `deck/fonts/`).

The sandbox cannot reach framer.website or Google Drive, so the `park-refs` workflow fetches them:
- `fetch_refs.py site` captured the template into `ref/hanza/`: full-page screenshots at desktop and phone width, page text, the computed type and colours, and the fonts.
- `fetch_refs.py videos` downloaded the shared Drive folder and re-encoded each clip small enough to publish (H.264, under 12 MB) into `deck/media/`, with a poster and a frame strip (`ref/video-strips/`).

- **Present:** open the link full screen and use the arrow keys or the space bar. On a phone, the slides become one scrolling page, the mind maps become branching lists and the calendar becomes an agenda.
- **Play a reference:** press Play on any clip card. The clip opens over the deck with sound and the browser's own controls. Esc, Close or a click outside puts it back.
- **Print or PDF:** printing `dist/index.html` from a browser gives one slide per page. The clips print as their stills.

## The slides

A social media pitch in 31 slides. The content plan is drawn as two mind maps, and four pages of reference clips show how it should look.

1. **Cover, our promise, your brief.** The promise: THE Park's feed becomes the city's night out (found, saved, booked). The brief answers the five things the post asked for, each with its pages.
2. **01 · The Park today (pages 4 to 8).**
   - The numbers: 92% occupancy, 43% of revenue from food, drink and nightlife, 42 hotels in 32 cities, 45 new hotels by FY2030.
   - The six channels linked from theparkhotels.com, each with a job and a cadence, plus Spotify and WhatsApp.
   - The house rule: "We post what only THE Park can", and the series each idea becomes.
   - The insight: The Park is named after a street.
3. **02 · Park Street, everywhere (pages 9 to 21).**
   - **The content map:** a mind map with the idea at the centre, four pillars (After Hours, By Design, The Table, The City) and fifteen series. Each series shows what you see and its format, and the three hero series are marked in orange.
   - **The references (pages 11 to 14):** the 20 clips from the shared folder, five a page and grouped by what they teach: name the series, film the craft up close, put the people first, make the room the story. Each card names the brand only where the clip shows it, says what is on screen, what we take from it and which of our series it feeds.
   - Eight posts a week, by pillar; the grid on Saturday 12 December, drawn as a phone; the voice, as three sample captions.
   - Three series pages with concept drawings: The Sessions (and its Reel, second by second), Room 1967 and Flurys 100.
4. **03 · How it runs (pages 22 to 29).** December on the feed, day by day; the handle map (the group feed and the six brands); the people who make the feed; what we measure; Mask360; quick answers to the six questions the brand team will ask; next steps ("Put us in the room.", with a "Ready to start?" ask).
5. **The close and the sources.**

Mask360's rule for cold pitches applies: show the read, take one position, show how it extends into a system, and end on an open door. So there is no pricing and no team grid.

## Building

```
STRICT=1 python3 pitches/the-park-hotels/deck/build.py
```

- `deck/content.py` holds the slide copy and layout. Page references are looked up from `ORDER`, and the clip captions are in `REFS`.
- `deck/art.py` holds the line drawings and the two mind maps.
- `deck/kit.py` holds the Hanza pieces: the running head, labels, buttons, cards, chapter rows and the video card.
- The build writes `dist/the-park-proposal.html` (the claude.ai artifact) and `dist/index.html` (the standalone page). It also copies the clips and stills the page uses into `dist/media/`. Publish those with the page: about 55 MB, the largest file 7.4 MB.
- `STRICT=1` fails the build on:
  - em or en dashes;
  - contrast constructions ("X, not Y", "rather than", "instead of");
  - filler words;
  - exclamation marks;
  - leftover placeholders.

## Before sending

- **Share the link.** The artifact is private until shared. To send a website link like the Westside one (`mask360westside`), the same EdgeOne deploy can be added for this deck. It has not been set up.
- **The reference clips** come from other hotels' feeds (The Savoy, Four Seasons, The Roseate, Bulgari, Rosewood, Amankila, Mama Shelter, Raffles Jaipur, Lacoste, a White Lotus tie-in, and five hotels not named on screen). Every reference page and the sources say Mask360 did not make them. Before sharing the deck beyond The Park, decide whether third-party clips should travel with it.
- **The feed audit.** Check the last 30 posts on @theparkhotels. If any idea on the house rule page already runs there, credit it or swap it, so the page doesn't sell the team its own work.
- **Venue accounts.** Confirm which bars and restaurants have their own handles before the handle map is shown as fact.
- **Client names on the Mask360 page.** These are taken from Kaavish's credentials notes: Anantara Jewel Bagh, Alta Stella, Onrique and DEA, Atlantis The Royal and SANA, the Penthouse at St. Regis and Moxy feeds, the Nexa Platinum Lounge result, and Dior, Ferrari India, L'Oréal and Dyson. Confirm permission to name each one in a pitch; Kaavish's notes say press uses career framing because of NDAs.
- **Contact details on the next steps page and the close:** kaavish@mask360.agency, +91 959 107 5100, mask360.agency, mask360.work. Confirm they are the ones to show.
- **The Sessions.** The deck says bands play original songs and sign a release, with no drinks brands in frame. Keep that, because full sets on YouTube need music rights.
- **Dates** assume a start on Monday 16 November 2026, with the first readout in the week of 22 February 2027.
- **Growth figure.** 45 new hotels is the company's own pipeline (87 hotels by FY30, Q1 FY27 material and the 2 Sep 2026 investor meet filing).

## Research: what matters about The Park

**Company and brand**
- Founded 1967 with The Park Kolkata on Park Street; the group's name comes from the street. Priya Paul (chair since about 1990) began the design repositioning in 1992. THE Park Bangalore (2000) was designed by Terence Conran. Six hotels are long-time Design Hotels members.
- "Anything But Ordinary" has been the line since the 2013 rebrand.
- Five hotel brands: **THE Park**, **THE Park Collection**, **Zone by The Park** (design-conscious and price-conscious, second cities), **Zone Connect by The Park**, **Stop by Zone**. The group also owns **Flurys**.
- 42 hotels in 32 cities (Business Traveller, Oct 2026). The company's latest target is **87 hotels and 6,719 keys by FY30**, with 45 hotels under development. Priya Paul says five THE Park hotels are under construction.

**Performance (Q1 FY27, quarter to 30 June 2026)**
- Revenue from operations ₹166.8 crore, up 8.1%. PAT ₹11.5 crore, down 14.2%.
- Occupancy **92%**. RevPAR about **₹6,858**. Sources disagree on ARR (₹7,459 against ₹9,310); ₹7,459 is consistent with RevPAR.
- Food, beverage, nightlife and lifestyle dining about **43% of revenue** (IDBI Capital).
- Management guides to high single-digit ARR growth.

**Growth and pipeline**
- March 2026: Zone by The Park Darjeeling, Zone Connect Gangtok and Zone Connect Katra opened. Zone Connect Patna opened in January 2026.
- Signed: Zone Connect Ayodhya (56 rooms) and Ujjain (64 rooms), April 2026; Zone Connect Bharatpur (63 keys), HMA filed with NSE on 28 Sep 2026; THE Park in a Siliguri tea estate (100 rooms); THE Park Juhu, Mumbai (due mid-2027); The Park Unizen with Ambuja Neotia (Feb 2026).
- **Ran Baas The Palace, Patiala** (THE Park Collection) opened January 2025: 35 suites, named among the world's most beautiful hotels of 2025 by Prix Versailles.
- **Flurys**: 111 stores (Q1 FY27). First standalone North India café, open 24 hours, in Gurugram (7 Aug 2026). Targeting 130 to 140 outlets by FY27 and about 300 later. **Centenary in 2027.**

**Venues**
- Kolkata: Someplace Else (live-music pub), Tantra (two-floor nightclub), Roxy, Zen, Aqua.
- New Delhi (Connaught Place): Aqua, Fire, Agni.
- Hyderabad: Aish.
- Group-run culture in Kolkata: the Park Street Christmas festival (co-organised by the Apeejay Surrendra Group) and the Apeejay Kolkata Literary Festival in January.

**Social and audience context**
- Last public snapshots found: @theparkhotels about 28K Instagram followers (about 2024), Facebook about 113K, LinkedIn about 84K. Check live numbers before quoting any of these.
- Booking.com, via Outlook Traveller: 80% of Indian travellers plan to spend most of their time at the property, against 51% globally.

## Outreach

This follows Kaavish's BD flow: a LinkedIn DM in proper case, then a cold email in two variants under 100 words. Each opens on a specific observation, with no self-introduction.

**LinkedIn DM**

> Anmol, The Park took its name from Park Street, Calcutta's night out. We built our reply around that: Park Street, everywhere. Someplace Else filmed in one take every month, one suite a year remade by a young Indian designer, and Flurys at 100. It is 31 pages, with twenty reference clips and the hospitality work behind it: [link]. Thirty minutes with your team would be enough to walk through it.
>
> Kaavish Ramchandani, Mask360

**Email, variant A (recommended: it opens on the observation)**

> Subject: Park Street, everywhere
>
> Hi Anmol,
>
> The Park took its name from a street. Park Street was where Calcutta went out, and Someplace Else, Tantra and Agni still carry that scene.
>
> Our reply to your call for agencies builds on it: each THE Park becomes the Park Street of its city. At 92% occupancy, growth comes from rate, tables and 45 new hotels, so we measure covers and direct bookings.
>
> The 31-page point of view: [link]
>
> Could we have thirty minutes with the brand team?
>
> Kaavish

**Email, variant B (numbers first)**

> Subject: 92% full, and 45 hotels to open
>
> Hi Anmol,
>
> At 92% occupancy, THE Park grows through rate, tables and 45 new hotels. That calls for social built around nights and measured in covers and direct bookings.
>
> Our point of view, in reply to your call for agencies: Park Street, everywhere, with The Sessions at Someplace Else and Flurys at 100. [link]
>
> Thirty minutes with the brand team?
>
> Kaavish

## Sources

- [Apeejay Surrendra Park Hotels Q1 FY27 results (Investywise)](https://www.investywise.com/apeejay-surrendra-park-hotels-limited-q1-fy27-financial-results/)
- [Q1 FY27: 92% occupancy, Flurys plans (ScanX)](https://scanx.trade/stock-market-news/companies/apeejay-surrendra-park-hotels-q1-results-net-profit-falls-14-yoy-115/48449041)
- [Q1 FY27 result review (IDBI Capital)](https://www.idbidirect.in/IDBIAdmin/Pdf/PARKHOTE_RR_19082026-19-August-2026-1444990745.pdf)
- [Q1 FY27: keys and the 87-hotel portfolio (Multibagg)](https://www.multibagg.ai/market-pulse/articles/parkhotels-q1fy27-98354)
- [Management meet update (PL Capital)](https://plindia.com/ResReport/PARKHOTE-10-9-26-PL.pdf)
- [Zone Connect Bharatpur HMA, filing to NSE, 28 Sep 2026](https://nsearchives.nseindia.com/corporate/ASPHL_28092026130940_Intimation.pdf)
- [Three new properties, portfolio at 39 (BW Hotelier)](https://www.bwhotelier.com/article/apeejay-surrendra-park-hotels-launches-three-new-properties-600985)
- [Ayodhya and Ujjain (Construction World)](https://www.constructionworld.in/policy-updates-and-economic-news/apeejay-surrendra-park-hotels-expands-into-ayodhya-and-ujjain/90373)
- [Flurys' first standalone café in Gurugram (Sahi)](https://www.sahi.com/news/apeejay-surrendra-park-hotels-launches-first-standalone-flurys-caf-in-gurugram-3391-PE1_COR)
- [Priya Paul: "Luxury should be anything but boring" (Business Traveller)](https://www.businesstraveller.com/insights/interviews/luxury-should-be-anything-but-boring-hotelier-priya-paul-on-disruption-empowerment-and-restoring-the-palace/)
- [BTN interviews Priya Paul](https://www.breakingtravelnews.com/focus/article/btn-interviews-priya-paul-on-reinventing-indian-hospitality-the-park-hotels/)
- [Ran Baas The Palace (Robb Report India)](https://www.robbreportindia.com/travel/india/a-royal-revival-in-the-heart-of-patiala)
- [The Park Hotels corporate overview](https://www.theparkhotels.com/corporate-information.html)
- [50 years of The Park Hotels (Hotel Designs)](https://hoteldesigns.net/industry-news/50-years-young-the-park-hotels-and-the-woman-behind-the-brand/)
- [Meeting Priya Paul (Sleeper)](https://www.sleepermagazine.com/stories/editorial/meeting-priya-paul/)
- [2013 rebrand, "Anything But Ordinary" (Travel Trends Today)](https://www.traveltrendstoday.in/the-park-hotels-unveils-new-brand-identity)
- [Zone by The Park launch (eHotelier)](https://insights.ehotelier.com/news/2015/01/13/new-design-hotel-brand-zone-by-the-park-launches-in-india/)
- [THE Park Kolkata dining](https://www.theparkhotels.com/kolkata/dining/)
- [Delhi Tourism: THE Park New Delhi](https://delhitourism.gov.in/dt/stay_in_delhi/the_park_new_delhi.html)
- [Kolkata Christmas festival on Park Street (News Arena)](https://www.newsarenaindia.com/states/kolkata-lights-up-with-christmas-festivities-on-park-street/31345)
- [17th Apeejay Kolkata Literary Festival (t2online)](https://t2online.in/goodlife/books/the-17th-apeejay-kolkata-literary-festival-will-be-held-at-the-alipur-museum-from-january-9-to-11--2026/2002616)
- [How Gen Z is redefining travel, Booking.com figure (Outlook Traveller)](https://www.outlooktraveller.com/News/india-travels-differently-now)
- [@theparkhotels on Instagram](https://www.instagram.com/theparkhotels/)
