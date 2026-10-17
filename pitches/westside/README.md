# Westside × Mask360 · proposal, version 4

A 16:9 slide deck from Mask360 to Westside (Trent Ltd), October 2026. It keeps the v3 look (white paper and black ink, thin uppercase Inter Tight, Bodoni numbers in ruled boxes, procedurally drawn cloth, a dark silk cover) without v3's app layer: no menu, search, tabs, "Details +" sheets, buttons, carousels or orange. The content is version 4's (verified facts, three ideas, the 15 mn plan). The v3 sources are in git history.

- **Send:** the website link (see `web.py` and `.github/workflows/deploy-westside.yml`). The page is `dist/index.html` plus the reference videos in `media/out/`.
- **Present:** open the link full screen and use the arrow keys or the space bar. On a phone, the slides become one scrolling page.
- **Print or PDF:** printing from a browser gives one slide per page.

## The pitch (33 slides, six chapters, then sources)

- **Front:** cover, our promise, contents (the six chapters with their conclusions).
- **01 Westside today:** the business in six numbers; the last twelve months on one strip; how Westside talks; the market (what rivals did, how Westside wins).
- **02 The opportunity:** what we found (sales happen in stores, marketing is counted in views); the look code that takes a shopper from a post to the billing counter.
- **03 The three ideas:** overview (15 mn); Styled by Westside (the idea, two pages of the team's reference clips, the plan with its team); the Westside Coffee Cart (idea, four cart designs, plan with its team); Window Stories (idea and the 311-store library, with its team).
- **04 The numbers:** how the 15 mn adds up against YNG's 6 mn; the model, line by line; how we measure footfall per store.
- **05 The test:** the offer and terms, with the founder's line "If the numbers don't move, you lose nothing."; the timeline.
- **06 Mask360:** who we are; next steps; close.
- **Sources:** every source behind the numbers, on the last page. Supporting material sits with the section it supports, so there is no separate appendix.

Each content slide is a headline that makes a point, a line on why it matters to Westside, then the facts or the plan (about 3,200 words on the main slides).

## Sources

Every number has its source on the slide.

- **Primary documents.** Trent's store updates and investor presentations (Q2 FY26 to Q1 FY27) and the FRONT ROW launch article were fetched as text into `research_notes/Westside proposal v4/sources/` by `.github/workflows/westside-sources.yml`, because the coding sandbox cannot reach the exchanges.
- **Research notes** in `research_notes/Westside proposal v4/`:
  - 01 facts;
  - 03 positioning over the last twelve months;
  - 04 competitor map;
  - 05 reach benchmarks;
  - 06 coffee-cart and windows feasibility.
- Notes 04 to 06 were written when web search was out of budget. The deck uses only their claims that were re-checked by search on 16 Oct 2026.

## Editing

- `v4/content.py`: slide copy and layout.
- `v4/data.py`: facts, the twelve months, the competitor rows and the impressions model. Totals are computed, so the parts always add up.
- `v4/art.py`: the line illustrations.
- `v4/fabric.js`: the cloth on the cover, the month strip and the idea tiles, drawn in the browser (from v3, with the warm textiles removed).
- `v4/deck.css`, `v4/deck.js`: the deck's styles, keyboard navigation, cloth painting and the video player.

Build with:

```
STRICT=1 python3 pitches/westside/v4/build.py
```

`STRICT=1` fails the build on placeholders (`[[ ]]`), on Zara or other banned words, and on orange in the CSS. The build writes `dist/index.html` (website) and `dist/westside-proposal.html` (claude.ai artifact).

**Reference videos.** Put the Drive folder link in `media/source.txt`. The `westside-media` workflow downloads the folder and runs `media.py`, which makes:

- AV1 and H.264 versions, at most 4K and 30 fps, bitrate-capped;
- a poster frame for each clip (`POSTER_AT` picks a later frame where the first one shows a logo).

The deck loads nothing until someone presses play.

## Before sending

- **Commercials.** Our fee, the production and media cap, and the names on the team.
- **Westside's real averages.** The model uses planning figures for Westside's own Reel views (20,000) and creator Reels (25,000). Replace them with Westside's numbers, and swap YNG's 6 mn for Westside's internal twelve-month total.
- **WestStyle Club.** The deck uses Trent's latest published figure (19 mn+ members, 30 Sep 2025). A later "11.85 mn active members (FY26)" figure could not be confirmed against the annual report.
- **Titles.** Confirm Shailina Parti's and Umashan Naidoo's titles before the meeting. The FRONT ROW article (3 Oct 2026) calls Naidoo Chief Creative, Brand & Beauty.
- **Rahul and Anjali.** As a pair, the names recall Kuch Kuch Hota Hai (Dharma Productions). Generic first names are low risk, but film cues (costume, music, lines) invite a claim. Keep the styling original, or swap the names before launch.
- **Coffee cart.** About 300 cups a day and the build cost are planning figures. Confirm them with a coffee partner. The partner operates under its own FSSAI licence, and every site needs mall or landlord consent.
- **Client list.** AJIO Luxe was removed from the Mask360 slide because it belongs to Reliance Retail, a Westside competitor. Confirm the nine years, the five office cities and each brand name (with permission to name it) before sending.
- **Commercial terms.** The test slide (28) reads: if it works, Westside pays our fee plus production and media within the cap; if it doesn't, no fee, and Mask360 carries production and media within the cap.
- **Reference clips.** Eight of the remaining clips show Target's logo or a Target store in the footage (18-19-48, 18-20-15, 18-20-10, 18-20-19, 18-20-04, 18-20-13, 18-42-50-2, 18-42-51-1). Posters were picked to avoid the logo, and 18-20-10 plays only from 0:04 to 0:35, between its opening and closing bullseye. The Target × Parke food truck (18-20-03) was removed: every frame is branded, and a branded truck with a menu right after our coffee cart invites the reading that the idea came from Target. Restore it by adding its `_v(...)` line back in `v4/data.py`.
