# Slide fact check, Westside v4 deck (round two)

Checked 16 Oct 2026 against `pitches/westside/v4/content.py` and `data.py` as they stand, and the deck text in the review folder. Every number, date, name, title and factual claim on the 22 slides is listed below with where it comes from.

**Status key**
- **primary source**: a line in a fetched file in `sources/` (Trent filings and decks, fetched press reports, trade articles, benchmark pages). Upstox and Angel One are fetched press reports of Trent's Q2 FY27 update; the filing itself was not fetched (`sources/rin_trent_q2fy27.txt` is a 403 page).
- **research note**: only in notes `01` to `06` in this folder, or in the earlier audit notes in `research_notes/Westside marketing audit 2026/`. Those notes were built from search snippets. They are not primary text.
- **Mask360 plan figure**: units, people, weeks, budgets, thresholds and model outputs that are Mask360's proposal.
- **unsupported**: no line in `sources/` or the notes supports it.

"FINDING" marks a claim that is unsupported, misquoted, misdated or wrongly labelled. The exact fixes are in the review findings.

Short file names: `q2fy26 deck` = `sources/nse_q2fy26_investor_presentation.txt`; `q4fy26 deck` = `sources/nse_q4fy26_investor_presentation.txt`; `q1fy27 deck` = `sources/nse_q1fy27_investor_presentation.txt`; `01`, `03` and so on = the notes in this folder; `audit/footfall` = `research_notes/Westside marketing audit 2026/footfall_cases_and_measurement.md`.

---

## The impressions model, recomputed (slide 15)

Rule in `data.py`: organic line = units × average; paid line = budget ÷ ₹120 × 1,000; low = 60% of organic, high = 150% of organic, paid fixed.

| Idea | Line | Low | Plan | High | Slide shows |
|---|---|---|---|---|---|
| Styled by Westside | Westside's pages, 36 × 20,000 | 0.432 | 0.720 | 1.080 | 0.43 / 0.72 / 1.08 |
| | YNG and city creators, 40 × 25,000 | 0.600 | 1.000 | 1.500 | 0.60 / 1.00 / 1.50 |
| | Clip and city pages, 55 × 35,000 | 1.155 | 1.925 | 2.888 | 1.16 / 1.93 / 2.89 |
| | Paid boost, ₹1.5 lakh at ₹120 | 1.250 | 1.250 | 1.250 | 1.25 |
| | **Subtotal** | **3.437** | **4.895** | **6.718** | 3.44 / 4.89 / 6.72 |
| Coffee Cart | Creators, 30 × 25,000 | 0.450 | 0.750 | 1.125 | 0.45 / 0.75 / 1.12 |
| | Clip, city and food pages, 76 × 35,000 | 1.596 | 2.660 | 3.990 | 1.60 / 2.66 / 3.99 |
| | Westside's pages, 18 × 20,000 | 0.216 | 0.360 | 0.540 | 0.22 / 0.36 / 0.54 |
| | Paid boost, ₹2 lakh at ₹120 | 1.667 | 1.667 | 1.667 | 1.67 |
| | **Subtotal** | **3.929** | **5.437** | **7.322** | 3.93 / 5.44 / 7.32 |
| Window Stories | Store teams and local creators, 60 × 15,000 | 0.540 | 0.900 | 1.350 | 0.54 / 0.90 / 1.35 |
| | City pages, 50 × 35,000 | 1.050 | 1.750 | 2.625 | 1.05 / 1.75 / 2.62 |
| | Westside's pages, 28 × 20,000 | 0.336 | 0.560 | 0.840 | 0.34 / 0.56 / 0.84 |
| | Paid boost, ₹1.75 lakh at ₹120 | 1.458 | 1.458 | 1.458 | 1.46 |
| | **Subtotal** | **3.384** | **4.668** | **6.273** | 3.38 / 4.67 / 6.27 |
| **Total** | | **10.750** | **15.000** | **20.313** | 10.75 / 15.00 / 20.31 |

- The arithmetic is right. Paid totals ₹5.25 lakh and 4.375 mn impressions. Organic totals 10.625 mn, and those lines count **views**, not impressions (`data.py` input comments; `05` line 38 defines an "impression" in this model as an organic view or a paid impression).
- Rows and subtotals differ by 0.01 in three places because of rounding: Styled plan rows add to 4.90 (subtotal shown 4.89, true 4.895); Coffee Cart low rows add to 3.94 (shown 3.93); Window Stories low rows add to 3.39 (shown 3.38). Two cells sit on an exact half and round down: 1.125 shows as 1.12 and 2.625 as 2.62.
- Where the figures appear, all consistent with the model:
  - 15 mn total: slide 7 title and lede; slide 15 title, total row (15.00) and bar.
  - Styled 4.9 mn, range 3.4 to 6.7: slide 7, slide 9; slide 15 subtotal 4.89.
  - Coffee Cart 5.4 mn, range 3.9 to 7.3: slide 7, slide 10 text, slide 11; slide 15 subtotal 5.44.
  - Window Stories 4.7 mn, range 3.4 to 6.3: slide 7, slide 13; slide 15 subtotal 4.67.
  - 4.9 + 5.4 + 4.7 = 15.0. The rounded lows add to 10.7, but slide 15 shows the unrounded 10.75; the two never appear on the same slide.
- Brief targets: Styled 3.5 to 5 mn (plan 4.9, inside); Coffee Cart 5 to 5.5 mn (plan 5.4, inside); total about 15 mn (15.0).
- Units on the plan slides match the model: slide 9 shows 36 Westside Reels, 40 creators and 55 page posts; slide 11 shows 30 creators and 76 page posts; slide 13 shows 60 window Reels. Lines not shown on those slides are the paid boosts, the cart's 18 Westside Reels, and the windows' 50 city-page posts and 28 Westside Reels.
- Sensitivity to the one sourced paid input. The same Upgrowth page gives fashion and apparel CPMs of ₹140 to ₹280 (`sources/upgrowth_instagram_cpm_2026.txt` lines 217-219). At ₹140 the boosts give 3.75 mn instead of 4.38 mn, the plan falls to 14.4 mn and the low to 10.1 mn. At ₹280 they give 1.88 mn, the plan falls to 12.5 mn and the low to 8.25 mn.

---

## Slide 1 · cover

| Claim | Status | File and line or quote |
|---|---|---|
| "From the post to the billing counter." | Mask360 plan figure | Founder's promise, `brief.md` point 16 |
| Styled by Westside, the Westside Coffee Cart, Window Stories | Mask360 plan figure | `brief.md` point 15 |
| Westside is part of Trent Limited | primary source | `sources/nse_fy26_results_press_release.txt` 127-129: "primary customer propositions of Trent include Westside" |
| "October 2026" | Mask360 plan figure | Date of the proposal |

## Slide 2 · promise

| Claim | Status | File and line or quote |
|---|---|---|
| "If the numbers don't move, you lose nothing." | Mask360 plan figure | `brief.md` point 16, word for word |
| "Give us one store launch or one festive drop." | Mask360 plan figure | `brief.md` point 16 |
| "Your people counters and your bills" | **unsupported** | `audit/footfall` 185: "whether people counters are already installed are unknown". FINDING |
| Read against stores that did not get the programme | Mask360 plan figure | `audit/footfall` 108 (matched-control design) |

## Slide 3 · Westside today

| Claim | Status | File and line or quote |
|---|---|---|
| 311 stores on 30 Sep 2026 | primary source (fetched press reports of the filing) | `q1fy27 deck` 208: "301 Westside"; `sources/upstox_trent_q2fy27.txt` 153: "opened 10 Westside stores in Q2"; 163: CITI "10/17/30 net Westside/Zudio/overall"; `sources/angelone_trent_q2fy27.txt` 38 |
| 50 more than a year earlier | primary source (arithmetic) | `sources/nse_q2fy26_update.txt` 20: "261 Westside"; 311 − 261 = 50; quarters +17, +22, +1, +10 (`bse_20260105_announcement.txt` 27, `nse_q4fy26_update.txt` 31, `q1fy27 deck` 207) |
| 97 cities on 30 Jun 2026, latest disclosed | primary source | `q1fy27 deck` 342-346: "97 … City presence … Data as of 30th June 2026" |
| 19 mn+ WestStyleClub members, 30 Sep 2025 | primary source | `q2fy26 deck` 93-95: "19 Mn+ WestStyle Club Members … Data as of 30th September 2025" |
| "the latest count we could confirm" | research note | `01` line 12: the FY26 11.85 mn "active" figure is unverified and uses another definition (line 72) |
| 6%+ of Westside revenue online, Q1 FY27 | primary source | `q1fy27 deck` 237: "online revenues contributed to over 6% of Westside revenues" |
| "the other 94% or so is spent in stores" | primary source (arithmetic) | same line |
| +23% Trent revenue growth, Jul to Sep 2026 | primary source (fetched press report) | `upstox` 145: "standalone revenue from operations … rose 23%"; `angelone` 30 |
| "fashion like-for-like growth: low single digits" (under the Jul to Sep tile) | primary source, **misdated** | `q1fy27 deck` 235: "Like-for-like growth for our fashion portfolio in Q1FY27 was in the low single digits" (Apr to Jun). The Q2 update gives no LFL (`01` W-31). FINDING |
| 400–500 new designs a week | research note | `01` line 137 and W-71; `03` P-30: "enabling around 50 designers to create between 400 and 500 designs each week, compared with roughly 50 previously" (Retail Insight Network's summary; Bloomberg text not seen) |
| "about 50 designers using AI tools" | research note | Same; `01` verification row 6: the two "50"s "may be a garble" |
| Source line: Q2 FY27 update dated 5 Oct 2026 | primary source | `angelone` 29: "On October 5, 2026"; `upstox` 145: "shared on Monday" (5 Oct 2026 is a Monday). Note `01` says 6 Oct; the deck is right and the note is wrong |
| Source line: "Bloomberg interview with Shailina Parti, 20 Jul 2026 (designs)" | research note, **wrongly labelled** | The figure comes from Retail Insight Network's summary, as slide 8 says (`03` P-30). FINDING |
| "Westside is growing by opening stores." | primary source | +50 net stores; LFL low single digits (`q4fy26 deck` 215, `q1fy27 deck` 235) |

## Slide 4 · the last twelve months

| Claim | Status | File and line or quote |
|---|---|---|
| "while 50 new stores opened" | primary source, **wrongly labelled** | +50 is the net change (`nse_q2fy26_update.txt` 20 to 311). Gross openings were at least 51 (17, 23, 1, ≥10: `q1fy27 deck` 153-185). FINDING |
| Nov '25: men's wedding style guide, Kala by E.T.A | research note | `03` line 51, P-05 (date inferred) |
| "An edit page; we found no campaign" | research note | `03` P-05 |
| Dec '25: Glitz & Glam with the I-pop group W.i.S.H., in store and online | research note | `03` line 56, P-09 (date estimated from page-age metadata), P-10 |
| Jan '26: no Republic Day or end-of-season sale campaign found | research note | `03` line 60, P-11 (absence) |
| Feb '26: Wesness Fun Run Mumbai, 8 February, W.i.S.H. live set | research note | `03` line 64, P-12 (Trent press release to BSE, 10 Feb 2026; not fetched) |
| 3,600+ participants | primary source | `q4fy26 deck` 334: "led by the Mumbai Fun Run with 3,600+ participants" |
| Mar '26: YNG, 4,000 members, 6 mn views | primary source | `q4fy26 deck` 342-345: "In Q4, YNG … 4,000-member community driving 6 million views" |
| Apr '26: Run2Quiz (Bengaluru, 12 Apr) and Run2Zumba (Mumbai, 26 Apr) start at stores, ₹499 | research note | `03` lines 73-74, P-17, P-18 |
| "no results published" | research note, **absence stated as fact** | `03` lines 33 and 36: not found "does not prove the thing did not happen"; "Nobody has reviewed the feed". FINDING |
| May '26: Wesness Fun Run Bengaluru | research note (month) | `03` line 78, P-19 (31 May 2026) |
| 3,300+ participants | primary source | `q1fy27 deck` 358-359: "Bangalore Fun Run with 3300+ participants" |
| Run2Rave, pickleball and heritage runs in four cities | primary source | `q1fy27 deck` 359-361 |
| Jun '26: AGM, about 50 new Westside stores a year | research note | `01` line 40, W-14; `03` P-34 (CNBC-TV18 reporter on X). `q1fy27 deck` 211 confirms the AGM outlook but not the number |
| Jun '26: "We found no brand activity" | research note | `03` line 82, P-35 (absence) |
| Jul '26: Run2Stepup Mumbai, 19 July, last Wesness event found | research note | `03` line 87, P-20, P-21 |
| Aug '26: no Independence Day or back-to-college work found | research note | `03` line 96, P-35 |
| Sep '26: 9 Days 9 Colours, the Navratri edit | research note (the notes date it differently) | `03` line 100 (September); `01` line 142 and W-46 (Oct 2026); P-36 "Sep-Oct 2026"; Navratri began 11 Oct (`03` line 115). FINDING (nice) |
| Sep '26: 311 stores at quarter end | primary source | As slide 3 |
| Oct '26: FRONT ROW, 80 looks, 150 culture-shapers, 30 New Faces | primary source | `sources/indianretailer_front_row.txt` 58 (3 Oct 2026), 68, 69, 71 |
| Three national Dance Off challenges to come | primary source | `indianretailer_front_row.txt` 70: "plans to launch three national Dance Off challenges" |
| Stat: 6 mn views from YNG | primary source, **period missing** | `q4fy26 deck` 342: "In Q4" (Jan to Mar 2026), shown on a twelve-month slide. FINDING |
| Stat: 3,600+ at the biggest Wesness run, Mumbai, February 2026 | primary source (figure) + research note (month) | `q4fy26 deck` 334; `03` P-12 |
| Stat: 0 published results we found that count a store visit | research note | `03` line 14: "no published result we found is a store-visit figure" |
| Source line: "Anything marked as not found means none in public sources." | **unsupported** | Contradicted by `03` lines 33, 36 and 246 and by `04` line 18 ("does not mean the thing did not happen"). FINDING |
| Source line: Q4 FY26 deck 22 Apr 2026; Q1 FY27 deck 6 Aug 2026; Indian Retailer 3 Oct 2026 | primary source | `q4fy26 deck` line 1; `q1fy27 deck` line 1; `indianretailer_front_row.txt` 58 |
| Source line names neither the 10 Feb 2026 Wesness release nor the AGM report | research note, **incomplete** | `03` P-12, P-34. FINDING (nice) |

## Slide 5 · how Westside talks

| Claim | Status | File and line or quote |
|---|---|---|
| Westside speaks through YNG, Wesness and FRONT ROW | research note | `03` line 7 |
| "The everyday voice is warm and inclusive; the events are editorial." | research note | `03` lines 12, 174-175 (from agency and executive descriptions, P-47, P-49) |
| "Nothing yet links the two, or takes people from a post into a store." | research note, **absence stated as fact** | `03` line 177: "not joined … that we could find. A feed review is needed". FINDING |
| New Indian talent: YNG creators, 30 New Faces, FRONT ROW | primary source | `indianretailer_front_row.txt` 71; `q4fy26 deck` 342 |
| Culture beyond clothes: I-pop, dance-offs, fitness runs | primary source + research note | `indianretailer_front_row.txt` 70 (dance-off); `q4fy26 deck` 333-337 (runs); `03` P-09, P-10 (I-pop) |
| Women together: Wesness runs in four cities, 3,600+ at the biggest | primary source | `q4fy26 deck` 334-337 |
| Own labels first: Bombay Paisley, E.T.A, Utsa, Vark, W Edit | research note + primary source | `03` line 170; `01` lines 81-96; W Edit: `indianretailer_front_row.txt` 68 |
| "Shoppers rarely hear about the 400–500 new designs a week." | research note | `03` line 232 (told "only to investors and Bloomberg"), P-30 |
| Festive story, local launches, end every post in a store | Mask360 plan figure | `03` lines 229, 231 |
| Coffee Cart "from Wesness finish lines to launch weekends" | Mask360 plan figure | `03` line 153: almost no store-launch communication found |
| Window Stories "Casts FRONT ROW's New Faces as the couples and families in the windows" | Mask360 plan figure, **contradicts slides 12-13** | Slide 12 uses two mannequins; slide 13 puts New Faces in the window Reels. FINDING (nice) |

## Slide 6 · the market

| Claim | Status | File and line or quote |
|---|---|---|
| Lede: "Each row is the most recent marketing we found for that brand" | research note, **wrong for two rows** | `04` line 162 (H&M Beauty ambassador Sharvari, Oct 2026) and line 236 (Myntra's Instagram affiliate programme, 14 Oct 2026) are later than the rows shown. FINDING |
| Shoppers Stop "288 stores, Jun 2026" | primary source, **wrongly labelled** | `sources/shoppersstop_q1fy27_release.txt` 412: "Department 2 115"; 422: "Total 8 288"; 151: "115 department stores". 288 includes 85 INTUNE, 73 beauty, 12 home and 4 airport stores. FINDING |
| "India Weds with Shoppers Stop", "The Travel Edit", "Get Spotlight Ready" with HYBE India (Apr to Jun 2026) | primary source | `shoppersstop` 109, 259 (Apr'26-Jun'26), 261 (Apr'26-May'26), 263 |
| Customer entries up 3% like-for-like | primary source | `shoppersstop` 105: "Customer entry grew by 3% LFL"; 268 |
| Release dated 22 Jul 2026 | primary source | `shoppersstop` line 2: "July 22, 2026" |
| Max Fashion (Landmark Group): "How New Is Your New?" with Siddhant Chaturvedi, Kalki Koechlin and Alaya F, weekly newness, Aug to Sep 2025 | research note | `04` lines 89-90, C-18, C-19. The exchange4media page did not fetch (`sources/e4m_max_fashion.txt` is a "Just a moment" page) |
| Pantaloons: first-ever ambassador Samantha Ruth Prabhu, festive "Spark Your Imagination", Oct 2025 | primary source | `sources/socialsamosa_pantaloons.txt` 83 (06 Oct 2025), 92: "first brand ambassador" |
| Pantaloons owned by ABFRL | research note | `04` line 104, C-20 (flagged for re-check) |
| Trends (Reliance Retail), "This Holiday, Trend It" with Aneet Padda, ₹1,499, QR code, 100+ holidays, 20 Apr to 17 May 2026 | primary source | `sources/pim_trends_this_holiday.txt` 113, 115, 117, 119 |
| Trends "enter a draw" | primary source, **misquoted** | `pim_trends_this_holiday.txt` 115: entrants create "a personalised AI-generated holiday song"; 117: "The most creative and engaging entries will be rewarded". It is a judged contest, not a draw. FINDING |
| H&M "71 stores in India" | primary source (date missing) | `sources/fashionunited_hm_hybe.txt` 34: "71 stores across 32 cities"; dated 30 Apr 2026 (`sources/urls.txt` 26) |
| H&M "Icons in the Making" with HYBE India, pop-ups in six cities, H&M Beauty stations, May to Jun 2026 | primary source | `fashionunited_hm_hybe.txt` 20, 22 |
| H&M Lollapalooza India 2026 collection | primary source (not cited on the slide) | `sources/alchempro_hm_lollapalooza.txt` 146 |
| Uniqlo: three openings in Bengaluru and Pune, Mar to Jun 2026 | primary source (Pune, Bengaluru Phoenix Marketcity) + research note (Mall of Asia, Mar 2026) | `sources/r4g_uniqlo_pune.txt` 157 (13 Apr 2026), 161 (Pune 15 May, Bengaluru 5 Jun); `04` lines 177, 185. The Franchise India page did not fetch |
| Uniqlo fleece campaign with Kriti Sanon and Jasprit Bumrah, Oct 2026 | primary source | `sources/indianretailer_uniqlo_fleece.txt` 58 (9 Oct 2026), 67 |
| Myntra: second Creator School, 300+ creators; triple earnings on festive content before the Big Fashion Festival (2026) | primary source | `sources/itv_myntra_creators.txt` 759 (23 Sep 2026), 772, 774, 778 |
| Myntra "online only" | research note | `04` line 225 (no stores; M-Now dark stores) |
| Win: "Every piece is Westside's own" | research note, **overstated** | `01` line 77: "97 percent in-house brands, with a few exceptions in the beauty segment" (2019); BW 2026 "100 per cent private-label model". Slide 8 says "Almost everything". FINDING |
| Win: "With 311 stores" | primary source | As slide 3 |
| Source line: no Lollapalooza or Uniqlo-openings source, no Myntra date; Max credited to exchange4media, which did not fetch | primary source, **incomplete** | As above. FINDING (nice) |

## Slide 7 · the plan

| Claim | Status | File and line or quote |
|---|---|---|
| One city, twelve weeks, three ideas, 15 mn impressions | Mask360 plan figure | Model recomputed: 15.000 mn |
| "Westside's biggest published content figure in the last year is 6 mn YNG views." | primary source, **period missing** | `q4fy26 deck` 342-344: "In Q4 … 6 million views" (one quarter, Jan to Mar 2026). FINDING |
| "at least 20% more reach than Westside's best comparable campaign" | Mask360 plan figure, **metric mislabelled** | The model counts views and impressions, never reach (`05` line 38: "The model reports impressions only, never reach"). FINDING |
| Built on YNG, Wesness and FRONT ROW | primary source | `q4fy26 deck` 331-345; `indianretailer_front_row.txt` 67 |
| Styled 4.9 mn (3.4 to 6.7); Cart 5.4 mn (3.9 to 7.3); Windows 4.7 mn (3.4 to 6.3) | Mask360 plan figure | Recomputed: 4.895 (3.437 to 6.718); 5.437 (3.929 to 7.322); 4.668 (3.384 to 6.273) |
| Baseline: 4,000 members, 6 mn views, 50,000+ engagements, 12,000+ shares | primary source | `q4fy26 deck` 344-345 |

## Slide 8 · Styled by Westside

| Claim | Status | File and line or quote |
|---|---|---|
| "Almost everything Westside sells is its own label" | research note | `01` line 77, W-44 |
| Designers create 400–500 new designs a week | research note | `03` P-30, `01` W-71 (Retail Insight Network summary) |
| Instagram and YouTube Shorts; formats; look codes | Mask360 plan figure | — |
| Studiowest make-up | research note | `01` line 102 (Studiowest is the beauty label) |
| Sources: Bloomberg via Retail Insight Network, 20 Jul 2026; BW Businessworld, 2026 | research note | `01` W-71, W-44 |

## Slide 9 · Styled by Westside, the plan

| Claim | Status | File and line or quote |
|---|---|---|
| 120 coded looks in twelve weeks | Mask360 plan figure | 10 a week × 12 = 120 |
| 3 stylists; 24 shoot days (2 a week); 36 Westside Reels (3 a week); 40 creators (3 to 4 a week); 55 page posts (4 to 5 a week) | Mask360 plan figure | 24 = 2 × 12; 36 = 3 × 12; 40 within 36-48; 55 within 48-60 |
| "YNG members first" | primary source | `q4fy26 deck` 344 (4,000-member community) |
| Creators with 50,000 to 500,000 followers | Mask360 plan figure | `05` lines 78-81 (tier assumptions) |
| "Stores featured: 48" in the test city | Mask360 plan figure, **unsupported premise** | No source gives Westside's store count for any city (`01` line 180: "a store list by city" not found). 311 stores across 97 cities is about 3 a city. FINDING |
| 11 people (1 + 1 + 3 + 2 + 2 + 1 + 1) | Mask360 plan figure | Adds up to 11 |
| 4.9 mn impressions, range 3.4 to 6.7 | Mask360 plan figure | Recomputed |

## Slide 10 · the Westside Coffee Cart

| Claim | Status | File and line or quote |
|---|---|---|
| Menu label: Bombay Paisley | research note | `01` line 81, W-51 |
| Menu label: Nuon | primary source | `q2fy26 deck` 239: "NUON" |
| Menu label: Gia | research note | `01` line 85, W-51 (2025 store launches) |
| Menu label: Wardrobe | primary source | `sources/westside_home.txt` 129-175 (Wardrobe products live on 16 Oct 2026) |
| Menu labels: Utsa, Vark | research note | `01` W-46 (Navratri 2026 edit) |
| Parks outside Westside stores, in malls, at colleges and in office parks | research note | `06` lines 22, 90, 128 (private forecourts, malls, campuses, tech parks) |
| "We pay for those posts, which is how three carts reach 5.4 mn impressions." | Mask360 plan figure, **wrongly labelled** | Model: creators 0.75 + pages 2.66 = 3.41 mn; Westside's Reels (0.36) and the ₹2 lakh boost (1.67) make up the rest. FINDING |

## Slide 11 · Coffee Cart, the plan

| Claim | Status | File and line or quote |
|---|---|---|
| 3 carts, Thursday to Sunday, six weeks, 72 cart days | research note + Mask360 plan figure | `06` line 247: "6 weeks, Thursday to Sunday (24 days per cart, 72 cart-days)" |
| 21,600 cups at about 300 a day | research note + Mask360 plan figure | `06` line 123: "Planning figure: 300 cups per cart-day, within a 200-400 range"; 72 × 300 = 21,600 |
| Coffee partner runs the bar under its own food licence | research note | `06` lines 20-21 (FSSAI State licence) |
| No public-street vending; mall and landlord consent | research note | `06` line 22 |
| 30 creators; 76 page posts | Mask360 plan figure | Matches the model |
| 12 people (6 + 3 + 1 + 1 + 1); two baristas per cart | Mask360 plan figure + research note | `06` lines 20, 24 |
| 5.4 mn impressions, range 3.9 to 7.3 | Mask360 plan figure | Recomputed |

## Slide 12 · Window Stories

| Claim | Status | File and line or quote |
|---|---|---|
| Rahul and Anjali getting ready for a date | Mask360 plan figure | `brief.md` point 3. Legal caution on the pairing: `06` lines 211-236 |
| Story list: new job, cousin's mehendi, Sunday lunch at Nani's, college reunion | Mask360 plan figure | — |
| Studiowest on the dressing table | research note | `01` line 102 |

## Slide 13 · Window Stories at scale

| Claim | Status | File and line or quote |
|---|---|---|
| 311 windows, one square per store | primary source | As slide 3 |
| First library of 6 stories; 12 written a quarter; a change every four weeks | Mask360 plan figure | — |
| 60 Reels in total | Mask360 plan figure | Matches the model |
| 6 people (1 + 2 + 1 + 1 + 1) | Mask360 plan figure | Adds up to 6 |
| 4.7 mn impressions, range 3.4 to 6.3 | Mask360 plan figure | Recomputed |
| FRONT ROW's New Faces star in the window Reels | primary source (programme) + Mask360 plan figure | `indianretailer_front_row.txt` 71: New Faces "participate in the brand's campaigns, digital content and runway presentations" |

## Slide 14 · from post to bill

| Claim | Status | File and line or quote |
|---|---|---|
| Five steps; look code; weekly store briefing | Mask360 plan figure | — |
| Codes matched to WestStyleClub bills | research note | `01` W-38: "over 90% of Westside's revenues are attributable to its loyal WSC members" (FY25) |

## Slide 15 · the numbers

| Claim | Status | File and line or quote |
|---|---|---|
| Every row, subtotal and total | Mask360 plan figure | Recomputed above; arithmetic correct; rows differ from subtotals by 0.01 in three places. FINDING (nice) |
| "clip and city pages at 35,000 views a post, from a Qoruz report via Social Samosa, 2025 (₹1 lakh buys 10–20 meme-page posts and 500,000+ views)" | primary source, **applied beyond its scope** | `sources/socialsamosa_qoruz_meme_pages.txt` 83 (31 Dec 2025), 95: "Rs 1 lakh in creator spend can drive 10 to 20 meme page posts, generating 500,000+ organic views". The report covers film marketing on meme pages; the model also uses it for city and food pages. FINDING |
| "Reels ads at ₹45–140 per 1,000 impressions in India (Upgrowth, 2026), planned at ₹120" | primary source, **incomplete** | `sources/upgrowth_instagram_cpm_2026.txt` 243: "Reels … Rs 45 to Rs 140 CPM"; but 217-219: "Fashion and apparel CPM: Rs 140 to Rs 280"; 184: wedding-season fashion "can pay 2 to 3 times". FINDING |
| Westside and creator averages (20,000, 25,000, 15,000) | Mask360 plan figure | `data.py` input comment |
| Low = 60% of organic, high = 150%, paid fixed | Mask360 plan figure | `data.py` |
| Bar: "YNG, views 6 mn" | primary source, **period missing** | `q4fy26 deck` 342: "In Q4". FINDING |
| "Views count plays; impressions count every showing." | **wrongly labelled** | 10.6 mn of the 15 mn are organic views (`data.py` inputs; `05` line 38), so most of the test is counted the way YNG's 6 mn is. FINDING |
| "commit to beat its reach by at least 20%" | Mask360 plan figure, **metric mislabelled** | As slide 7. FINDING |

## Slide 16 · measurement

| Claim | Status | File and line or quote |
|---|---|---|
| Draft threshold: 5% or more on entries over twelve weeks | Mask360 plan figure | — |
| People counters at the entrance | **unsupported premise** | `audit/footfall` 185: whether counters are installed "unknown"; 158: install them "at least 8–12 weeks before launch" if absent. FINDING |
| "One store can show a lift of about 10%; a city's stores pooled can show smaller lifts." | research note, **misquoted** | `audit/footfall` 108: "one store can reliably detect only lifts of about 8–15%+ over a 4–6 week window. Smaller effects need three or more treated stores or a longer window." FINDING |
| Store totals only, never personal data | Mask360 plan figure | `audit/footfall` 181 (aggregate counters) |

## Slide 17 · the test

| Claim | Status | File and line or quote |
|---|---|---|
| "If the numbers don't move, you lose nothing." | Mask360 plan figure | `brief.md` point 16, word for word |
| Twelve weeks live, all three ideas; Option A store launch; Option B wedding season | Mask360 plan figure | Deliberate decision |
| Fee paid only above the threshold; Mask360 carries production and media on a miss, within a cap | Mask360 plan figure | Deliberate decision |
| "counter and bill data" | **unsupported premise** | As slide 16 |

## Slide 18 · timeline

| Claim | Status | File and line or quote |
|---|---|---|
| Set up 2 to 29 November | Mask360 plan figure | 2 Nov 2026 is a Monday; 29 Nov a Sunday: 4 weeks |
| Live 30 November to 21 February | Mask360 plan figure | 30 Nov 2026 is a Monday; 21 Feb 2027 a Sunday: 84 days, 12 weeks |
| Readout week of 22 February 2027 | Mask360 plan figure | Monday |
| Gantt: cart weeks 7-12 (six weeks); Styled and windows weeks 5-16 | Mask360 plan figure | Matches slides 9, 11 and 13 |
| Working session in the week of 26 October | Mask360 plan figure | With slide 20's "within 72 hours" and "Monday after you sign", a session late that week cannot start on 2 Nov. FINDING (nice) |
| "Option B covers both wedding windows, with the mid-December to mid-January pause in between" | **unsupported** | No 2026-27 wedding calendar in the notes. The only dated window is 2025: "46 lakh weddings between 1 Nov and 14 Dec 2025" (`research_notes/Westside marketing audit 2026/india_fashion_consumer_and_market.md` 175). FINDING |

## Slide 19 · Mask360

| Claim | Status | File and line or quote |
|---|---|---|
| Agency in India and the UAE; nine years; Mumbai, Delhi, Bengaluru, Dubai, Abu Dhabi | **unsupported** | No line in `sources/` or the notes. FINDING |
| Brands: Dior, L'Oréal, FCUK Beauty, Dyson, Anantara, Atlantis The Royal, St. Regis, Ferrari, Rolls-Royce, Zorae UAE, Rustomjee, Chandak Group | **unsupported** | No line in `sources/` or the notes. FINDING |
| Swisse UAE | unsupported in the research; in the repo | `m360-os/seed/seed.json` 50-51: "Swisse Wellness UAE" |

## Slide 20 · next steps

| Claim | Status | File and line or quote |
|---|---|---|
| Working session; shortlist; 72 hours; Monday after signing | Mask360 plan figure | — |
| Kaavish · Mask360 | unsupported in the research; in the repo | `m360-os/seed/seed.json` 82: "What comes to Kaavish" |
| mask360.agency | unsupported in the research; in the repo | `m360-os/harness/fixtures/apollo-sample.csv` |

## Slides 21-22 · references

| Claim | Status | File and line or quote |
|---|---|---|
| 24 clips the team collected, captioned by format; "references, not our work" | Mask360 plan figure | `data.py` REF_GROUPS (WhatsApp exports, 576 × 1024). Deliberate decision; not re-opened |
