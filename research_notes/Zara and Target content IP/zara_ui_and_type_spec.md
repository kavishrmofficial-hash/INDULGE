# Zara UI and typography spec (web + app, 2025-2026), with a Target contrast note

Research date: 15 October 2026. Written for the Mask360 x Westside "Seen at Westside" pitch: a designer is rebuilding the deck "in Zara's UI and fonts".

## Read this first: what this run could and could not check

- **WebSearch.** The first call returned "this turn's web search budget is used up (limit: 200 WebSearch calls per turn, shared by every agent in it)". The sibling Zara and Target agents used up the budget earlier today. So this run made **no new web searches**.
- **Direct fetches.** Every one was refused:
  - WebFetch failed with `getaddrinfo ENOTFOUND` on www.dezeen.com and fontsinuse.com.
  - curl got 403 policy denials on CONNECT for www.zara.com, static.zara.net (Zara's image and asset host), fontsinuse.com, en.wikipedia.org, www.target.com and fonts.google.com. The proxy status log records these at 15:20-15:21 UTC.
  - Because of this, **I could not read Zara's CSS, take screenshots, or open a Fonts In Use page.**
- **What is actually evidenced here comes from three places:**
  - **[C] Cited.** Facts and URLs found by the sibling agents earlier today (15 Oct 2026). They saw these pages only as search-result summaries and never read them in full. Source files: `zara_channels_and_app.md`, `zara_content_properties.md`, and `../Westside marketing audit 2026/zara_playbook_and_india_competitors.md`. I did not re-read the pages.
  - **[L] Locally verified, 15 Oct 2026.**
    - Font licences from the npm registry metadata of the `@fontsource/*` packages, which mirror Google Fonts.
    - The Debian copyright files of the fonts installed in this container: `fonts-liberation2` 2.1.5-3, `fonts-freefont-ttf` 20211204+svn4273-2, `fonts-inter` 4.0+ds-1.
    - The weights each package ships, read from the `@fontsource` tarballs.
  - **[M-high / M-med / M-low] Model memory.** My training data runs to about June 2026. **These items have no URLs on purpose**, because citing from memory would risk inventing sources. Treat M-med and M-low as hypotheses to check on a machine that can open zara.com.
- **[R] Recommendation.** A value I chose for the rebuild. It is **not a claim about Zara.**

---

## 1. Takeaway

- **What is safe to borrow.** Zara's digital look is a fashion-magazine grammar laid over a very plain shop:
  - full-bleed, mostly portrait photography and video;
  - one oversized Didone wordmark used like a masthead;
  - everything else in small, uppercase, black-on-white grotesque text with almost no colour, no rounded corners, no shadows and no promotional noise.

  This grammar is well supported. Three sources describe it:
  - UXMatters (Sept 2023) on the video slider: the site puts appearance before usability.
  - Pixc on the white space and the "not bombarded with products and promotions" feel.
  - TheIndustry.fashion (Jan 2022) on Zara bringing its website closer to fashion-magazine aesthetics with Meisel, Baron, Templer and Guadagnino.
- **The logo is well documented.** It was redrawn by Baron & Baron and appeared in late January 2019: a high-contrast serif with overlapping letters [C].
- **The UI typeface is not verified.** The common belief, which I share from memory, is that zara.com and the app set UI text in a Neue Helvetica / Helvetica Neue-family neo-grotesque [M-med for "Helvetica-family", M-low for the exact cut]. **I could not confirm the 2025-26 CSS font-family.** I found no evidence for or against a custom "Zara" UI typeface.
- **Font choice for the deck.** Neue Helvetica is a commercial Monotype/Linotype font and needs a web licence to embed. The deck should use open fonts:
  - For UI text, use **Inter Tight** (OFL-1.1; it ships 100-900, so it has the light weights) or a self-hosted Helvetica clone: **TeX Gyre Heros**, **Nimbus Sans**, **FreeSans** or **Liberation Sans/Arimo**.
  - The clones copy Helvetica's shapes or widths but have **no light weights**: Arimo ships only 400-700 [L].
  - For the masthead, use **Bodoni Moda** (OFL-1.1, 400-900, optical size axis) [L] in Westside's own wordmark. **Do not recreate the ZARA logo.**
- **How the app moves.** The app's motion grammar comes from memory, not evidence [M-med]:
  - full-screen campaign cards you swipe vertically;
  - the WOMAN / MAN / KIDS / HOME sections you swipe horizontally;
  - bottom sheets for size and filters.

  It translates directly into a CSS scroll-snap deck: vertical slides inside horizontal chapters.
- **Target is the opposite pole** [M-med]: sentence case, bold weights, a saturated red, rounded buttons and chatty helpful microcopy. Use it as the contrast slide, not as a second style.

---

## 2. Cited findings [C]

All of these were seen as search-result summaries by sibling agents earlier today. Dates are as the sources give them.

### 2.1 Logo

- **The redesign.** In January 2019 Zara replaced its wordmark with one by **Baron & Baron**, Fabien Baron's agency.
  - It is a high-contrast, Didone-style serif with **tightly overlapping letters** and curved Z and R legs. Reviewers said it recalled Baron's 1990s Harper's Bazaar type.
  - Critics called it "claustrophobic". Erik Spiekermann called it "the worst piece of type [he's] seen in years".
  - Sources: Dezeen, 4 Feb 2019, https://www.dezeen.com/2019/02/04/zara-logo-controversial-rebrand-baron-baron/ ; FashionUnited, 28 Jan 2019, https://fashionunited.uk/news/fashion/zara-changes-its-logo/2019012841252
- **Same creative team since 2017.** Baron & Baron and Fabien Baron still art-direct Zara Studio (with Meisel and Templer) through SS26, the same team since about Spring 2017. Sources: The Fashion Spot (FW24), https://www.thefashionspot.com/?p=893717 ; The Impression (SS26), https://theimpression.com/zara-studio-colection-spring-2026-ad-campaign-review/

### 2.2 Sub-brand type

- **Zara Origins.** For the Winter 2022 edition, M/M Paris designed "an entirely new graphic identity", with a **new typeface** and seven symbols ("imagotypes") applied to branding and garments. Source: The Impression, 2022, https://theimpression.com/?p=10877908
  - So at least one sub-line has its own custom face. Its name and how it is used on zara.com were not found.
- **Other sub-lines.** SRPLS numbers its collections ("CLLCTN 01-16"). Athleticz launched on 30 Sep 2021 with **its own logo and its own online section**. Sources: Modaes, https://www.modaes.com/empresa/zara-irrumpe-en-la-guerra-del-deporte-con-una-linea-para-hombre ; FashionSnap, 27 Sep 2021, https://www.fashionsnap.com/article/2021-09-27/zara-athleticz/

### 2.3 Website feel

- **Home page.** UXMatters (Sept 2023) describes "a scrolling slider with video in the background". It says "the designers paid more attention to the appearance of the Web site rather than its usability". https://www.uxmatters.com/mt/archives/2023/09/usability-audit-of-the-zara-web-site.php
- **Product pages.** Pixc's teardown (undated, older) notes lots of white space and that you are "not immediately bombarded with products and promotions", meant to feel like walking into the store. https://pixc.com/blog/product-page-design-zara/
- **Magazine aesthetics.** Zara worked with Meisel, Baron, Templer and Guadagnino to bring zara.com closer to fashion-magazine aesthetics. TheIndustry.fashion, Jan 2022, https://www.theindustry.fashion/zara-continue-brand-repositioning-with-new-york-city-ballet-collaboration/
- **Editorial URLs.** Editorial pages sit inside the shop under an editorial URL pattern, for example https://www.zara.com/au/en/woman-caramel-editorial-l18264.html and The Fold-er page https://www.zara.com/dz/en/woman-the-fold-manon-mkt18461.html (seen as search snippets).
- **The Fold-er (June 2026).** A "digital magazine" section on zara.com and the app.
  - It launched with four columns by Leandra Medine, Arielle Charnas, Manon De Velder and Laura Roso Vidrequin.
  - Each column uses the author's own photos with a shop link under every image.
  - Source: FashionUnited, 12 Jun 2026, https://fashionunited.com/news/retail/zara-creates-its-casita-and-launches-the-fold-er-an-editorial-section-with-influencers-and-trendsetters/2026061272927

### 2.4 Imagery

- **Black and white.** The Zara Studio campaign images are often black-and-white studio portraits:
  - FW24: black-and-white Meisel portraits on a digital billboard mounted on a truck.
  - SS25 "On the Road": rough black-and-white studio portraits referencing Avedon.
  - FW25 "Whispers of the Wild": black and white.
  - SS26 turns "faded and domestic", in powder blue, sage and blush.
  - Sources: The Impression, https://theimpression.com/zara-studio-collection-fall-2024-ad-campaign-review/ ; Fashion Gone Rogue, 20 Mar 2025, https://www.fashiongonerogue.com/zara-studio-spring-2025-campaign ; FashionUnited press, 20 Mar 2026, https://fashionunited.uk/press/fashion/zara-spring-summer-2026-studio-collection/2026032086985
- **In-house studio.** Zara "shoots a mind-boggling number of editorial campaigns every season, all in-house. Studio bays are lined up like chic factory stations." The Nod Mag, 29 Aug 2025, https://thenodmag.com/content/zara-high-street-fashion-50-years-visual-language
- **AI-edited model photos.** In Dec 2025 Zara asked models from past shoots for permission to have their photos digitally altered with AI into new outfits. Inditex: "We are using artificial intelligence only to complement our existing processes." Sources: https://cityam.com/zara-turns-to-ai-edited-models-amid-shop-closures ; https://www.retaildetail.eu/news/fashion/one-photo-shoot-hundreds-of-outfits-zara-unleashes-ai-on-real-models/
- **The "Zara pose".** Odd on-figure poses (crouching, floating) have a meme following, @awkwardzara. Refinery29, about 2021-22, https://refinery29.com/en-us/awkward-zara-model-poses

### 2.5 Social copy

- One blog says @zara's Instagram posts "often have no captions or hashtags, just strong imagery". It says the 50th-anniversary series used "no slogans, no flashy fonts". NewswireJet, about Oct 2025, https://newswirejet.com/zara-brand-personality/ [single low-authority source].

### 2.6 App features

These shape the interactions the deck can borrow.

- **Store Mode (from Sept 2020, Spain first).**
  - Real-time store stock, and online orders ready to collect in about 30 minutes with a QR code.
  - Fitting-room booking: the app assigns a room, and the customer has **5 minutes** to claim it. Booking works only while in the store.
  - "Click & Find" shows on an in-store map where an item is.
  - Sources: Retail Gazette, Jul 2023, https://www.retailgazette.co.uk/blog/2023/07/best-retailer-apps/ ; Stylus, https://stylus.com/retail-brand-comms/zara-s-store-mode-supercharges-click-collect ; PureWow, https://www.purewow.com/fashion/zara-shopping-hacks
- **Zara Try-On (from Dec 2025).** App only.
  - Flow: a generative-AI consent notice, then a selfie and a full-body photo. The output is a still image and a 360-degree video of the avatar.
  - Inditex reported more than 7M sessions in 43 markets at its FY2025 results (11 Mar 2026). The annual report page says 26 markets.
  - Sources: https://www.inditex.com/itxcomweb/gp/en/press/news-detail/b870d5ec-6b7e-491d-b38e-340cd69036df/fy2025-results ; https://echoboomer.pt/zara-try-on-mostra-como-fica-a-roupa-no-coropo/
- **Travel mode.** Added June 2025. https://app.thefuturelaboratory.com/articles/zara-launches-travel-mode-feature-to-enhance-customer-experience
- **Zara Streaming.** Hosted on Zara's own app and web "to maintain control over its aesthetics". Episode 4, "Le Dîner", was a roughly 15-minute film that premiered in the app and online on 11 Dec 2025. Sources: FashionUnited UK, Jun 2024, https://fashionunited.uk/news/retail/zara-to-expand-live-shopping-broadcasts-to-the-us-uk-and-europe/2024060375868 ; https://highxtar.com/en/zara-turns-a-dinner-into-cinema-with-le-diner-its-new-christmas-film/

### 2.7 Font licences (locally verified [L], 15 Oct 2026)

| Font | Licence | Weights shipped | How verified |
|---|---|---|---|
| Inter | OFL-1.1 | 100-900 | npm `@fontsource/inter` 5.3.0; Debian `fonts-inter` 4.0 copyright: "OFL-1.1 and Apache-2.0" |
| Inter Tight | OFL-1.1 | 100, 200, 300, 400, 500, 600, 700, 800, 900 | npm `@fontsource/inter-tight` 5.3.0 tarball |
| Arimo | OFL-1.1 | **400, 500, 600, 700 only** | npm `@fontsource/arimo` 5.3.0 tarball |
| Liberation Sans 2.x | SIL OFL 1.1 ("Digitized data copyright (c) 2010 Google Corporation with Reserved Font Arimo, Tinos and Cousine. Copyright (c) 2012 Red Hat, Inc. with Reserved Font Name Liberation.") | Regular, Bold (+ italics) | Debian `fonts-liberation2` 2.1.5-3 copyright file |
| FreeSans (GNU FreeFont) | GPL-3+ with Special Font Exception (embedding in documents is allowed without making the document GPL) | Regular, Bold, Oblique, Bold Oblique | Debian `fonts-freefont-ttf` 20211204 copyright file |
| Bodoni Moda | OFL-1.1 | 400-900 (also a variable optical-size axis) | npm `@fontsource/bodoni-moda` 5.3.0 tarball; `@fontsource-variable/bodoni-moda` exists |
| Playfair Display | OFL-1.1 | 400-900 | npm tarball |
| Libre Bodoni | OFL-1.1 | 400-700 | npm tarball |
| GFS Didot, Prata, Abril Fatface, DM Serif Display, Gloock, Noto Serif Display | OFL-1.1 | not checked | npm `license` field |
| Hanken Grotesk, Archivo, Public Sans, Schibsted Grotesk, Albert Sans, Instrument Sans, Geist, Roboto | OFL-1.1 | not checked | npm `license` field |

TeX Gyre Heros is not on npm (`@fontsource/tex-gyre-heros` returns 404), and CTAN was unreachable. Its licence below therefore comes from memory.

---

## 3. Inferences, recollections and the rebuild spec

### 3.1 Recalled UI facts (model memory, unverified this run)

**Typefaces**

- **UI text, product names, prices** [M-med that it is a Helvetica-family neo-grotesque; M-low on the exact cut]. Neue Helvetica / Helvetica Neue in light-to-regular weights is the commonly repeated identification. **No CSS evidence was gathered this run.** I found no evidence of a custom "Zara Sans" for UI, and its absence is also unproven.
- **Editorial headlines** [M-low]. Zara mostly avoids big headline type. Campaign and editorial titles appear as small uppercase sans labels over or under imagery, or the wordmark stands alone. Sub-lines (Origins, Athleticz, SRPLS) carry their own logos [C for Origins and Athleticz].
- **Logo placement** [M-med].
  - On the home page and the app home, the wordmark is very large at top left, over the full-bleed campaign image or video. It switches between black and white to contrast with the image, and works like a magazine masthead.
  - Inside listing and product pages it sits on white at a smaller size.
  - Whether the subject's head deliberately overlaps the masthead (the Bazaar cover trick) is [M-low]. I could not check it.

**Header** [M-med]

- Left: a thin-line hamburger, then the wordmark.
- Right: **SEARCH** shown as an underlined text-field-style label rather than a magnifier icon, then **LOG IN**, **HELP**, and a shopping-bag glyph with the item count.
- Whether it now reads literally "SHOPPING BAG [0]" is [M-low] and unverified.

**Menu** [M-med]

- The hamburger opens a panel. At the top is a row of section tabs in uppercase: WOMAN, MAN, KIDS, HOME. Whether **BEAUTY** is a top-level tab in 2025-26 is [M-low].
- Below the tabs is a vertical uppercase list of categories in the same small size. Special sections (for example Origins, which a snippet places under New Collection [C]) are mixed into the list.

**Listing pages** [M-med for the overall feel; M-low for the exact options]

- Dense portrait image grid with near-zero gutters and small uppercase name and price lines under each image.
- There is a control to change grid density on web and in the app. The exact options in the brief (**1/2/4/6 columns**) are **unverified**. The app may switch density by pinch.

**Price format** [M-med]

- Number, then currency code, in many markets (for example "29.95 EUR"). India uses a rupee sign and two decimals (for example "₹ 2,990.00").
- Sale prices: the original is struck through next to the new price. The colour of sale emphasis in 2025-26 is unknown.

**Product page**

- **Desktop** [M-med]: three zones.
  - Left: product description and links.
  - Centre: a vertical stack of large images.
  - Right: uppercase name, price, colour and reference, sizes, then a black rectangular **ADD** button.
- **Mobile and app** [M-med]: full-width image carousel. Tapping ADD opens a **bottom sheet** with the size list. A sold-out size shows a "COMING SOON" or notify state [M-low on the wording].
- **Links and accordions** [M-med]: "COMPOSITION, CARE & ORIGIN" and "CHECK IN-STORE AVAILABILITY". A shipping/returns entry and a size-guide entry exist, but their exact labels are [M-low].
- **Product descriptions** [M-high on style]: short, factual sentences that start with the garment ("Straight-fit blazer with a lapel collar...") rather than adjectives or exclamations.

**App home** [M-med]

- Full-screen campaign cards stacked vertically, with snap paging. You swipe horizontally between sections (WOMAN, MAN, KIDS, HOME), and the section names sit as an uppercase row near the top.
- This is consistent with the "scrolling slider with video" UXMatters reported for web [C].
- Bottom sheets are used for size selection and filters [M-med]. The exact bottom tab-bar items are [M-low].

**Colour** [M-med]

- Pure black text on white UI. White type and wordmark over photography.
- Greys only for disabled or out-of-stock states. No brand accent colour in the chrome. Colour comes from the photography and the declared seasonal palette (SS26: powder blue, sage, blush [C]).

**Shapes** [M-med]

- Square corners everywhere, 1px hairlines, no drop shadows, no gradients, no pill buttons.

**Image ratios**

- Product photography is portrait, somewhere between **2:3 and 3:4** [M-low; the exact ratio is unverified].
- Campaign images and video fill the viewport with cover crops: 9:16 on phones, wide on desktop [M-med].

**Microcopy** [M-med]

- Uppercase single-word imperatives and nouns: ADD, SEARCH, LOG IN, HELP, FILTERS, VIEW ALL.
- No exclamation marks, no emoji, no superlatives, no "%" in hero areas.

### 3.2 Helvetica clone licences (memory)

- **TeX Gyre Heros** [M-high]. A GUST e-foundry font based on URW Nimbus Sans L. It is released under the **GUST Font License**, which is legally equivalent to LPPL 1.3c and asks that modified versions be renamed. It comes in Regular, Bold and their italics, plus Condensed (`texgyreheroscn`), and has **no light weight**.
- **Nimbus Sans** (URW++) [M-med]. The URW base35 set released through Ghostscript/Artifex is **AGPL-3.0 with a font-embedding exception**. The older "Nimbus Sans L" set was GPL with a font exception (with AFPL also offered). Check the licence file of the exact package you ship. It has Regular, Bold and Narrow, and **no light weight**.
- **FreeSans** [L licence; M-high lineage]. It derives from URW Nimbus Sans L and ships 4 styles.
- **Liberation Sans / Arimo** [L licence; M-high on metrics]. Both are metric-compatible with Arial, which itself matches Helvetica's widths. Line lengths therefore match Helvetica, but the letter shapes are Arial-like, with angled stroke ends.

### 3.3 Target (contrast) [memory only; the sibling file `target_style_and_ip.md` also lists Target typography as unknown]

- **Typeface** [M-med]. target.com is commonly identified as using a custom Helvetica cut, "Helvetica for Target", with Helvetica and Arial as fallbacks. Its retail UI and ads use bold weights heavily.
- **Red** [M-med]. The web red is usually given as #CC0000. The red-and-white bullseye logo [M-high] and the Bullseye dog mascot [M-high] are core assets.
- **Casing and tone** [M-med]. Sentence case. Friendly service microcopy ("Add to cart", "Pick up", "Same Day Delivery", "Drive Up"). Rounded, filled red buttons. Bright, flat colour sets and wit in campaign art direction.
- **The contrast with Zara.** Zara is light, uppercase, monochrome, square-cornered and quiet. Target is bold, sentence-case, red, rounded and talkative.

### 3.4 Rebuild spec (recommended values [R])

**Fonts**

```css
--ui: "Inter Tight", "TeX Gyre Heros", "Nimbus Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;  /* 300/400/500 */
--mast: "Bodoni Moda", "Playfair Display", Didot, "Bodoni 72", serif;                                   /* 400-500, opsz 96 */
```

Self-host woff2 and use `font-display: swap`.

**Type scale (phone 390 px / desktop 1440 px)**

| Element | Phone | Desktop | Spec |
|---|---|---|---|
| Masthead wordmark | 40-60% of viewport width | 22-28vw, max about 420px | Bodoni Moda 400-500, tracking -0.04 to -0.06em, line-height 0.8 |
| Chapter tabs | 12px | 13px | Uppercase, 400, tracking +0.06em; active state = 1px underline or 500 weight |
| UI labels and buttons | 11px | 12px | Uppercase, 400, +0.05em |
| IP or product name | 12px | 13px | Uppercase, 400, +0.03em |
| "Price" or KPI line | 12px | 13px | 400, `font-variant-numeric: tabular-nums` |
| Body | 13px / 1.45 | 15px / 1.5 | Sentence case, 300-400, max 36ch |
| Display headline (sparingly) | 28-40px | 56-88px | Uppercase light sans (300, tracking 0) **or** one Didone word, at most 8 words |

**Grid**

- 4 columns on phone, 12 on desktop. Outer margin 16px on phone, 24-32px on desktop.
- Product-grid gutter 0-2px. Text sits 8px under the image.

**Colours**

- #000 on #FFF.
- #FFF on images, with a 20-30% black scrim only behind the text.
- Secondary grey #767676 (meets AA contrast on white).
- Hairlines `rgba(0,0,0,.12)`.
- One accent at most, and it should be Westside's own colour.

**Images**

- Full-bleed slides use `object-fit: cover` at 100svh.
- Cards use `aspect-ratio: 3/4`.
- Use art-directed `<picture>` crops for 9:16 and 16:9.

---

## 4. Gaps (could not verify)

1. **Zara's actual 2025-26 CSS `font-family` stack** for web and app. Is it Neue Helvetica, another grotesque, or a custom face? This is the key gap. To close it: on an unblocked machine open zara.com, run DevTools > Computed > font-family plus the Network tab filtered to fonts, and check the iOS app's bundle font files.
2. **Fonts In Use, Typewolf and typography-forum write-ups** on Zara's web type. None was opened.
3. **Exact listing-grid density options** (1/2/4/6 or otherwise), gutters and the default column count on phone and desktop.
4. **Exact labels:** the shopping bag ("SHOPPING BAG [0]" or an icon with a count), the PDP accordion names beyond "COMPOSITION, CARE & ORIGIN", the sold-out size wording, and whether BEAUTY is a top-level menu tab.
5. **Product image aspect ratio** (2:3 or 3:4) and campaign video specs.
6. **The app's bottom tab bar** contents and whether vertical full-screen swipe on home is still the 2026 pattern after The Fold-er and Try-On were added.
7. **Sale-price styling** (colour, percentage badge) and whether India shows prices as "₹ 2,990.00".
8. **Whether the 2019 wordmark has been redrawn since.** No source found either way.
9. **Target:** whether "Helvetica for Target" is current, the official red hex or Pantone, and Target Style's own visual system. All of these come from memory only.
10. **TeX Gyre Heros and Nimbus Sans licence texts** were not re-read this run; CTAN and the GitHub sources were not opened.
11. **Search budget.** A follow-up run with a fresh WebSearch budget, ideally on a machine that can open zara.com and fontsinuse.com, should close gaps 1-8 in about 15-20 searches and two DevTools sessions.
