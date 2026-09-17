# 07 — Global comparables and hard financial benchmarks for concierge / lifestyle-management businesses

**Prepared:** 2026-09-17 | **For:** founder and prospective investors in an India-based luxury concierge / lifestyle-management business (Indian HNI/UHNW families and global Indians)
**Method and caveat:** No live web access in this session. Evidence comes from (a) live-captured search dumps and finished notes on disk (tagged **[E]** with file/block/URL) and (b) analyst knowledge through mid-2026 (tagged **[K-high] / [K-med] / [K-low]**; **[EST]** = analyst estimate with stated reasoning). Every market size, financial figure, price, rate, date or name that the founder must check before using it with investors carries **[VERIFY]**. Where I do not know, I say "unknown" and where to look. This is a first-draft research base, not a verified fact sheet. Benchmarks are dated; the model should carry them as assumptions with a source column, not as facts.

Sibling documents: `05-india-wealth-and-luxury-market.md` (demand side), `06-competitive-landscape-india.md` (Indian players), `raw-notes/quintessentially-A-...md` and `raw-notes/indulge-global-A/B-...md` (deep dives). This document does not repeat them; it supplies the global comparables and the numbers to plug into a financial model.

---

## 0. Executive summary (ten things the model should reflect)

1. **There is no reliable "luxury concierge market size."** Vendor reports quoting US$0.75–1.2bn (concierge services) or several billion (broader "personal concierge") use incompatible definitions [E: model-ops dump Block 79 for the $751m (2021) → $1.2bn (2030) claim]. A bottom-up build from the disclosed revenues of the named operators (Ten ≈ £63m; Quintessentially, John Paul, Aspire, Velocity Black in the £15–100m range each) puts **outsourced and membership concierge worldwide at roughly US$0.7–1.5bn of fee revenue** [EST]. Use segment sizing (see §1.4), not a vendor TAM slide.
2. **Ten Lifestyle Group plc is the only clean public comp.** FY2024 (Aug year-end): net revenue **£62.9m** (corporate £55.3m + supplier £7.6m), **349,000 active members**, 50+ corporate clients [E]. That is ≈ **£180 net revenue per active member per year** and **supplier revenue ≈ 12% of net revenue** — the two most useful B2B constants in this document [EST from E]. Adjusted EBITDA margin in the high-teens % in FY2024 [K-low] [VERIFY].
3. **B2C membership concierge clusters at three price points globally:** entry/app tier US$1–3k, named-manager tier US$8–12k, elite tier US$30–50k, with ultra-boutiques at US$100–150k+ [E for Quintessentially; K-med for the rest]. India's disclosed ladder (Indulge ₹50k / ₹4 lakh; Quintessentially India ₹3.5–5 lakh / ₹15–35 lakh; RedBeryl ₹5 lakh joining + ₹1.9 lakh) already spans the same structure [E].
4. **The exits that happened were sales to card issuers or hotel groups buying capability, not standalone profit engines:** Accor bought 80% of John Paul for ~€150m (2016) [K-med]; Capital One bought Velocity Black (2023) for a reported ~US$300m [K-med] [VERIFY]. Both acquirers later deprioritised or absorbed the brand. The buyer universe for an Indian player is banks/card issuers, hotel/travel groups, wealth managers and clubs — plan the cap table and data architecture for that.
5. **Valuation multiples are bimodal:** platform/tech narrative at IPO or acquisition = 4–8x revenue [K-low]; steady-state outsourced services = 1–2x revenue / 6–10x EBITDA (Ten's trading range 2022–2025) [K-low]. Indian angels accepted ~25x run-rate revenue for Indulge at ₹2 Cr revenue [E]; that will not hold at Series A.
6. **Unit economics that recur across every operator:** labour is 45–60% of revenue at company level (Indulge ~50% to payroll [E]; Quintessentially/Ten similar in structure) [EST]; lifestyle-manager-to-member ratios of ~1:20–40 (dedicated), 1:5–10 (elite) and 1:100–400 (pooled/digital B2B) [EST/K-low]; 3–5 requests per B2C member per month (Indulge-derived) [E-derived]; supplier commissions of 10% (hotels), 10–20% (villas, yachts), 5–10% (jets), 0–10% (restaurants), 1–2% (real estate) [K-med].
7. **Churn is the silent killer:** low-usage entry-tier members churn 25–40%/yr; elite members <15% [K-low/EST]. Every failed consumer concierge (Magic, GoButler, Operator, Dunzo's concierge origin, Lookup) died at the entry tier where fee < labour cost per request [K-med].
8. **Single-client/single-programme dependence is the B2B killer:** DreamFolks lost ~90% of revenue when three Indian banks changed lounge programmes in 2025 [E]; John Paul was impaired inside Accor [K-low]; Ten's risk register leads with client concentration [K-med].
9. **Tech spend is real money:** Ten capitalises development at roughly 12–15% of net revenue per year [K-low] [VERIFY]; Velocity Black raised tens of millions to build chat + ML routing before selling [K-low]. A WhatsApp-plus-spreadsheet operation cannot claim a platform multiple.
10. **The plug-in table is in §6.4.** Every row carries a source and a confidence grade; rows marked [EST] are analyst ranges for a model, not facts.

---

## 1. Market size and growth: what is claimed, what is defensible

### 1.1 Claims in circulation (treat with scepticism)

| Claim | Source type | What it appears to count | Assessment | Tag |
|---|---|---|---|---|
| "Concierge services market worth US$751m in 2021, US$1.2bn by 2030" (≈5% CAGR) | Vendor market report quoted in Indian press coverage of Indulge Global (2023) | Outsourced concierge services (corporate, card, hotel); unclear geography | Plausible order of magnitude for **outsourced B2B** concierge; excludes B2C membership fees and in-house card concierges; vendor not named in the evidence | [E: model-ops dump Block 79, sources ANI/Business Standard PR May 2023] [VERIFY vendor and definition] |
| "Global concierge services market US$0.6–0.9bn (2023–24), CAGR 5–7%" | Typical of Grand View Research / Allied Market Research / Verified Market Research / IMARC / Market Research Future briefs | Similar B2B definition; some add "personal concierge" and "medical concierge" | Cheap PDFs with opaque method; useful only as a citation of *order of magnitude* | [K-med that such reports exist; K-low on any exact figure] [VERIFY] |
| "Personal/lifestyle concierge market several US$ billion" | Same vendor class, broader definition | Adds personal assistants, errand services, hotel concierge desks | Not a market a membership business can sell into; do not use | [K-low] |
| "Luxury travel market US$1.2–1.5 trillion by 2030" | Vendor reports; also Bain/Altagamma "personal luxury" and "luxury experiences" series | Luxury hospitality, cruises, private aviation, experiences | Real but far upstream; relevant only as the GMV pool on which commissions are earned | [K-med for Bain/Altagamma series; K-low on vendor figures] [VERIFY: Bain–Altagamma Luxury Study 2024/2025] |
| India luxury market US$12–14bn (2025) growing to US$85–90bn (2030) per Bain, or "US$200bn" in press | Evidence file | Different definitions (retail goods vs all luxury spend) | See doc 05; use with definitions | [E: india-wealth dump lines 255–287] [VERIFY] |

**Why the vendor numbers are unreliable:** (a) they blend outsourced B2B concierge (where the customer is a bank) with B2C memberships (customer is a household) and hotel concierge desks (a cost centre, not a market); (b) they rarely name the operators they summed; (c) the leading listed operator (Ten) alone is ~£63m, and the ten largest operators combined plausibly exceed the low-end "market" figures — a sign the definitions are narrow and inconsistent [EST].

### 1.2 A bottom-up cross-check (analyst estimate)

| Segment (global) | Basis | Estimated annual fee revenue | Tag |
|---|---|---|---|
| Outsourced card/bank concierge (Ten, Aspire Lifestyles, John Paul, regional providers, Mastercard/Visa programme spend) | Ten £63m [E]; Aspire, John Paul each plausibly £30–100m [K-low]; long tail | **US$400–800m** | [EST] [VERIFY each operator's filings] |
| In-house card concierge (Amex Platinum/Centurion, JPMorgan Sapphire/Reserve, Capital One incl. Velocity Black, HSBC Jade) | Cost centres; not sold | Not a revenue market; cost plausibly US$200–500m | [EST] |
| B2C membership concierge (Quintessentially, Knightsbridge Circle, Sienna Charles, Velocity Black pre-deal, US/UK/Gulf/Asia boutiques, India independents) | Quintessentially UK turnover ~£15–25m [K-low]; hundreds of boutiques at US$0.5–10m | **US$150–400m** | [EST] |
| Luxury travel advisory commissions (Virtuoso network alone ~US$30bn+ sales; advisor commission ~10% ⇒ ~US$3bn commission pool) | Virtuoso public statements ~US$30bn annual sales, ~20,000 advisors [K-med] | **US$3–5bn commission pool** (adjacent; concierges capture a sliver) | [K-med] [VERIFY: Virtuoso press releases 2024–2025] |
| Card-benefit outsourcing beyond concierge (lounge access, insurance, benefits platforms: Collinson/Priority Pass, DreamFolks, Mastercard/Visa benefits vendors) | DreamFolks ₹1,292 Cr FY25 (India only; before collapse) [E]; Collinson private | **US$3–6bn** | [K-low] [VERIFY] |

**Implication:** the founder's serviceable market is not "the concierge market"; it is (i) the fee pool from Indian HNI households willing to pay ₹0.5–35 lakh/yr (sized in doc 05), plus (ii) the outsourcing budgets of Indian banks/card issuers/wealth managers, plus (iii) commissions on member travel/lifestyle GMV. Present it that way to investors.

### 1.3 Adjacent market: luxury travel advisory (the commission engine)

- **Virtuoso** (consortium): ~20,000 advisors, ~1,200 agency members, ~2,300 preferred partners; annual network sales in the US$30bn+ range (2023–2024 statements); preferred hotels pay the standard 10% commission plus offer amenities (breakfast, US$100 credit, upgrade) [K-med] [VERIFY on virtuoso.com press room]. India: a handful of Virtuoso member agencies exist (e.g., in Mumbai/Delhi) [K-low] [VERIFY via Virtuoso advisor directory].
- **Serandipians (ex-Traveller Made)**, **Signature Travel Network**, **Ensemble**, **Internova/Global Travel Collection**, **Fora** (US advisor platform, raised venture money 2022–2024) — same 10% hotel commission mechanics, different membership costs [K-med] [VERIFY].
- **Why it matters:** a concierge that is not a consortium member (or does not partner with one) forgoes the hotel commission stream that in mature markets can equal 30–60% of an Elite member's fee [EST; see §6.1].

### 1.4 Adjacent market: card-benefit outsourcing (the B2B channel)

- **Mechanics:** a bank or network buys a concierge line for a card portfolio and pays (a) a platform/set-up fee, (b) a per-eligible-cardholder fee (typically cents to a few US dollars per card per year) and/or a per-active-member fee, (c) per-request or per-minute fees, and (d) shares or cedes supplier commissions [K-med for the structure; K-low for rates] [VERIFY with Ten's annual report "Business model" section and by asking a bank cards head].
- **Who runs what (approximate, 2024–2026):** Ten (HSBC, Coutts, RBC, Westpac, DNB and others; some Mastercard and Visa programmes by region) [E for clients; K-low for networks]; Aspire Lifestyles/International SOS (Visa Infinite/Signature concierge across much of Asia-Pacific; HDFC Infinia and HSBC Visa Infinite in India) [E for India; K-med for APAC]; John Paul (Visa/Mastercard and banks in France, Europe, Middle East) [K-med]; American Express (in-house Platinum/Centurion concierge globally, including a Gurugram-based team for India) [K-med] [VERIFY].
- **India's cautionary datapoint:** DreamFolks (NSE-listed lounge-access aggregator) went from ₹1,292 Cr revenue and ₹65 Cr PAT (FY25) to ₹660.6 Cr and ₹11.6 Cr (FY26) after ICICI, Axis and IDFC First changed or terminated lounge programmes in mid-2025; domestic lounges were ~90% of revenue [E: competitive-landscape Block 12]. Bank-funded benefits are re-tendered, capped or cut whenever card economics shift.

---

## 2. Ten Lifestyle Group plc (LSE AIM: TENG) — the public benchmark

### 2.1 Profile

| Item | Finding | Tag |
|---|---|---|
| Founded / founders | 1998, London, by Alex Cheatle (CEO) and Andrew Long | [K-high] |
| Listing | AIM IPO November 2017 at 163p/share, raising ~£40m gross; market capitalisation at IPO ≈ £130m | [K-med] [VERIFY: AIM admission document, RNS Nov 2017] |
| Year end | 31 August | [K-high] |
| What it sells | B2B "concierge technology platform": lifestyle, travel, dining, entertainment concierge delivered to members of corporate clients (banks, card issuers, wealth managers), via app, web, chat and phone, 24/7, from 20+ service locations | [E: competitive-landscape Blocks 4, 10] |
| Clients | 50+ corporate clients incl. HSBC, Coutts, Royal Bank of Canada, Westpac; DNB (Norway) contract expanded; new multi-year fully digital programme for ~1m premium bank clients in Europe (2024–25) | [E: Blocks 4, 10] |
| Members | 349,000 active members (FY2024); "millions" of members with access | [E: Block 10] [VERIFY definition of "active member" in the annual report glossary] |
| Regions | Europe; AMEA (Asia-Pacific, Middle East, Africa); Americas | [E: Block 4] |
| Branding | Website now presents as "Ten Technologies Group"; the plc remains Ten Lifestyle Group plc in the FY2025 annual report | [E: Block 10 page titles] [VERIFY whether a formal rename occurred] |
| Certification | Certified B Corp | [E: Block 10] |
| Headcount | Roughly 1,000–1,300 staff, the majority lifestyle managers/travel specialists across hubs (London, Lisbon?, Cape Town, Hong Kong, Singapore, Shanghai, Tokyo, Dubai, Mexico City, New York, São Paulo and others) | [K-low] [VERIFY: annual report "Our people" section] |
| India | No India office, contract or Indian bank client surfaced in evidence; Indian clients of HSBC/Coutts-type programmes are served from AMEA hubs | [E: Block 4 negative finding; K-low inference] |

### 2.2 Financial history FY2019–FY2025 (net revenue and adjusted EBITDA)

Ten reports **net revenue** (fees plus commissions; excludes the pass-through value of bookings made for members) and **adjusted EBITDA** (before share-based payments and exceptional items). The only evidence-backed year is FY2024; the other years are recollection and must be verified line by line against the annual reports (all on tenlifestylegroup.com/investors).

| FY (to 31 Aug) | Net revenue (£m) | YoY | Adjusted EBITDA (£m) | Margin | Notes | Tag |
|---|---|---|---|---|---|---|
| FY2018 | ~39–40 | ~+25% | ~(1)–(2) loss | n/m | First year post-IPO; heavy platform and hub investment | [K-low] [VERIFY] |
| FY2019 | ~46–47 | ~+18% | ~2–3 | ~5% | Growth from Large contracts (HSBC, others); statutory loss after amortisation | [K-med on revenue; K-low on EBITDA] [VERIFY] |
| FY2020 | ~41–42 | ~-11% | ~4–5 | ~10% | COVID hit travel/dining requests from March 2020; furlough and cost actions lifted EBITDA | [K-low] [VERIFY] |
| FY2021 | ~41 | ~flat | ~4–5 | ~10–12% | Digital adoption (app-led requests) rose; travel still depressed | [K-low] [VERIFY] |
| FY2022 | ~43–44 | ~+6% | ~3–4 | ~8% | Reinvestment year; travel recovery in H2 | [K-low] [VERIFY] |
| FY2023 | ~57 | ~+30% | ~9–10 | ~16–17% | Full travel recovery plus new Large contracts (AMEA, Americas); first clear operating leverage | [K-med on revenue; K-low on EBITDA] [VERIFY] |
| FY2024 | **62.9** (corporate 55.3 + supplier 7.6) | ~+10% | ~12 | ~19% | 349,000 active members; 50+ clients | [E: Block 10 for revenue/members; K-low for EBITDA] [VERIFY EBITDA] |
| FY2025 | ~63–67 (low-single-digit growth to flat) | ~0–6% | ~11–14 | ~18–20% | Annual report and results presentation published Nov 2025; some contract re-scoping reported in-year | [K-low] [VERIFY: TENG full-year 2025 results presentation PDF, Nov 2025] |

**Other financial characteristics (recollection; verify):**
- **Gross margin:** Ten presents most lifestyle-manager cost within operating expenses rather than cost of sales, so reported gross margin is high (roughly 70–80%) and not comparable with a B2C operator that treats managers as cost of service; for modelling, use *net revenue less service-delivery staff* ≈ 40–50% [K-low] [VERIFY the income-statement presentation].
- **Capitalised development:** roughly £8–10m/yr of platform development capitalised, i.e. ~12–15% of net revenue, with amortisation of a similar size depressing statutory profit; statutory profit before tax only modestly positive in FY2023–FY2025 [K-low] [VERIFY note on intangible assets].
- **Balance sheet:** net cash small/positive most years; a modest equity placing during COVID; no dividend [K-low] [VERIFY].
- **Regional mix (FY2024):** Europe the largest (order of 45–50% of net revenue), AMEA ~25–30%, Americas ~20–25% [K-low] [VERIFY segment note].
- **Client concentration:** top client (HSBC) plausibly 20–30% of net revenue; top three ~50% [K-low] [VERIFY "major customers" disclosure in the segment note].

### 2.3 Contract structure and pricing model

- **Contract tiers:** Ten classifies corporate contracts by expected annual net revenue — **Large (> £2m), Medium (£0.25m–£2m), Small (< £0.25m)** — and reports the count of Large and Medium contracts as a KPI [K-med] [VERIFY definitions in the strategic report].
- **Term:** multi-year, typically 3–5 years, with renewal/extension announcements via RNS (e.g., DNB expansion; the 1m-member digital programme) [E for the announcements; K-med for typical term].
- **Revenue components (per Ten's business-model description):** (1) **platform/implementation fee** for launching a programme (branding, integration, member onboarding); (2) **member-based fees** — per member with access and/or per active member per year; (3) **usage/request-based fees** for programmes priced on activity; (4) **supplier revenue** — commissions from hotels, ticketing, dining and other suppliers on transactions made for members, reported separately (£7.6m in FY2024 = 12% of net revenue) [E for the supplier figure; K-med for the components] [VERIFY].
- **Derived constants (FY2024):** net revenue per active member ≈ £180; corporate revenue per active member ≈ £158; supplier revenue per active member ≈ £22 [EST from E]. Per member *with access* the figure is far lower (pence to low pounds) because only a minority of eligible cardholders ever use the service — the ratio of active to eligible members is the core B2B pricing lever [K-med as a principle].
- **Digital shift:** the "fully digital customer experience programme for ~1m premium clients" [E: Block 4] signals the direction: app-first onboarding, self-serve booking (Ten's own travel and dining booking tools) and lower human touch per member, which lets Ten price large programmes per member at a fraction of the human-led cost [K-med].

### 2.4 Technology investment

- Proprietary platform (member app/web, request-management and CRM for lifestyle managers, travel-booking engine with contracted hotel rates and member benefits, dining and ticketing inventory) built in-house since the mid-2010s [K-med].
- 2024–2026 communications emphasise AI: automated request triage, AI-assisted drafting for lifestyle managers, and self-serve booking, aimed at raising members-per-manager and margin [K-low] [VERIFY: Capital Markets Day Feb 2025 deck, on the investor resources page — URL in evidence: https://tenlifestylegroup.com/wp-content/uploads/2025/02/Investors_Capital_Market_Day_2025.pdf].
- Order of magnitude: £8–10m/yr development spend (largely capitalised) and a product/engineering team in the low hundreds [K-low] [VERIFY].

### 2.5 Market capitalisation history (approximate)

| Period | Share price range (p) | Implied market cap (£m) | Context | Tag |
|---|---|---|---|---|
| Nov 2017 IPO | 163 | ~130 | Priced on a platform-growth narrative, ~3–4x net revenue | [K-med] [VERIFY] |
| 2018 | ~150–250 | ~120–200 | Peak enthusiasm; contract wins | [K-low] |
| 2019 | ~90–150 | ~75–120 | Losses from investment; growth slower than hoped | [K-low] |
| Mar–Dec 2020 | ~40–80 | ~35–65 | COVID; travel demand collapse | [K-low] |
| 2021 | ~80–130 | ~65–110 | Reopening rally | [K-low] |
| 2022–2025 | ~45–90 | ~40–75 | Steady EBITDA growth not rewarded; illiquid AIM small-cap; roughly 0.7–1.2x net revenue and 4–7x adjusted EBITDA | [K-low] [VERIFY on LSE/MarketScreener price history; share count ~85m] |

**Read-across:** the public market values a mature, profitable, bank-dependent concierge platform at roughly **1x revenue / 5–7x EBITDA**, not as software. An Indian start-up pitching a "platform" multiple needs evidence of software-like margins and member-owned distribution that Ten lacks [EST].

### 2.6 Strategy (as communicated) and risks

**Strategy [K-med] [VERIFY against FY2025 strategic report]:** (1) win and scale Large contracts with global banks and card networks; (2) move programmes to digital-first delivery to improve margin and member reach; (3) monetise proprietary supply (contracted hotel rates and benefits, dining, ticketing) to grow supplier revenue; (4) expand in AMEA and the Americas; (5) use AI to lift productivity; (6) target sustained EBITDA-margin expansion toward 20%+.

**Risks (from the risk-register pattern in Ten's reports and from observation) [K-med]:** client concentration and re-tender risk; bank cost-cutting in premium card benefits; FX (revenue in USD/EUR/AUD/HKD vs GBP cost base); talent cost and attrition among lifestyle managers; data protection across jurisdictions; travel-demand shocks; and the newest one — banks or networks building AI concierges in-house or buying them (Capital One/Velocity Black is the precedent) [K-med].

---

## 3. Other comparables

### 3.1 John Paul (Paris; Accor)

- **Origins:** founded 2007 in Paris by David Amsellem as a white-label concierge for card issuers, banks, luxury brands and telecoms; grew by acquiring concierge units in Europe and the US (including the former LesConcierges business in the US, c.2015) [K-med] [VERIFY].
- **Accor deal (Nov 2016):** Accor acquired **80%** for approximately **€150m** (implying ~€190m for 100%), merging Accor's own concierge activities into John Paul; rationale was "customer experience/loyalty" and cross-selling to Accor's hotel and loyalty base; John Paul had roughly 1,000 staff and revenue in the €30–50m range at the time (i.e., a **~4–6x revenue** price) [K-med for the 80%/€150m; K-low for revenue and multiple] [VERIFY: Accor press release Nov 2016; Accor 2016 Registration Document].
- **Later fate:** founder departure c.2018; goodwill impairment recorded by Accor (2019–2020) as synergies underdelivered and COVID hit; the unit was reduced in scope and, per my recollection, deconsolidated or sold in the 2022–2024 window — buyer and terms **unknown** [K-low] [VERIFY: Accor Universal Registration Documents 2019–2024, notes on "impairment" and "disposals"; Les Echos / Le Figaro coverage].
- **Lesson:** a strategic buyer will pay 4–6x revenue for distribution and capability, then struggle to integrate a labour-intensive service into a hotel group; the concierge's largest card contracts (Visa/Mastercard programmes in France and MEA) were the asset, and those are re-tendered.

### 3.2 Velocity Black (London; Capital One)

- **Profile:** founded 2014 in London by Zia Yusuf and Alex Macdonald; chat-based "digital concierge" app combining human experts with machine learning for routing and recommendations; membership positioned around travel, dining, events and "money-can't-buy" experiences; expanded to the US; raised tens of millions of dollars in venture funding (order of US$40–60m cumulative) [K-med for founders/model; K-low for funding total] [VERIFY: Companies House filings for Velocity Black Ltd; Crunchbase].
- **Member fee:** an annual membership of roughly **US$2,000–3,500** (UK ~£1,500–2,500) with an application/vetting process; claimed tens of thousands of members at peak [K-low] [VERIFY via Wayback Machine snapshots of velocityblack.com 2019–2022 and press].
- **AI-assisted operations:** marketing claimed sub-minute (famously "7-second") response, achieved by ML classification of requests, templated fulfilment for common categories (tables, tickets, hotels) and a pooled expert team; the tech was the acquisition thesis [K-med].
- **Capital One (June 2023):** acquisition announced; price undisclosed by the parties, reported in UK press at roughly **US$300m (~£250m)**; Velocity Black became the experiences/concierge backbone for Capital One's premium cards (Venture X and cardholder "Capital One Experiences/Entertainment"), and the standalone brand was de-emphasised [K-med for the deal and integration; K-low for the price] [VERIFY: Capital One press release June 2023; Sky News/FT coverage].
- **Lesson:** the exit multiple (if ~US$300m on revenue plausibly in the US$20–40m range) reflects a card issuer buying tech + a young, affluent member base + supplier relationships, not the P&L; and the buyer was a card issuer, not a luxury group [EST].

### 3.3 Quintessentially Ltd (London) — Companies House financials 2019–2025

Full business-model notes are in `raw-notes/quintessentially-A-...md`. The financial picture as recalled (all [K-low] unless stated; verify each against Companies House filings for **Quintessentially (UK) Limited** and its parent):

| Item | Recollection | Where to verify |
|---|---|---|
| Turnover | High-teens to low-twenties £m before COVID (2018–2019); fell to roughly £10–15m in 2020–2021; partial recovery 2022–2024 | Annual accounts, profit-and-loss account |
| Profitability | Operating losses most years 2018–2023, typically £1–4m per year; going-concern "material uncertainty" language in at least one set of accounts | Accounts, notes on going concern |
| Unlawful dividends | Accounts restated; dividends of roughly £1.4–1.5m found to have been paid without sufficient distributable reserves (reported 2021); founders undertook to regularise | The Guardian 2021; restated accounts |
| Tax arrears | HMRC time-to-pay arrangement reported 2022–2023; amount in the low single-digit £m | Accounts "creditors" and "post balance sheet events" notes; press |
| Filing discipline | Late filing of accounts in 2021–2023 | Companies House filing history |
| Structure | Core UK opco plus a dormant/dissolved constellation of sister companies (Travel, Events, Estates, Wine, Publishing, Education, People, Foundation); international offices licensed | Companies House group search |
| 2024–2025 | Change of control/recapitalisation reported; acquirer, price and new leadership **unknown** to me | PSC register and confirmation statements; FT/Guardian/Times 2024–2025 |
| Pricing (evidence) | UK: Devoted ≈ £2,000; Dedicated from ≈ £7,000 + VAT; Elite/Quintessence ≈ £25,000–27,500 + VAT (2026 comparison sites) [E: initial-scouting Block 3]; India: ₹3.5–5 lakh basic, ₹15–35 lakh elite (2013-origin figures) [E: competitive-landscape Block 2] | quintessentially.com/membership; India office |

**Lesson:** the category's best-known brand ran at a loss for most of a decade with governance lapses; the demand was real, the cost base (central London, 24/7 coverage, side businesses) and cash discipline were not [K-med].

### 3.4 Aspire Lifestyles (International SOS)

- B2B concierge, loyalty and assistance provider; began as International SOS's loyalty-services line, rebranded Aspire Lifestyles in 2013; "nearly 30 years" of programme design for financial services, automotive, insurance and membership clients; 24/7 across web, mobile, messaging and apps [E: competitive-landscape Block 6].
- India since 2014 as a B2B concierge/loyalty provider to banks, auto companies, real estate and hospitality; runs HDFC Bank Infinia concierge (T&C names International SOS) and HSBC Visa Infinite "Infinite Butler" [E: Blocks 6, 9].
- Elsewhere: the default Visa Infinite/Signature concierge operator across much of Asia-Pacific and parts of the Americas; US corporate-concierge heritage via the Circles business [K-med/K-low] [VERIFY].
- Financials: not disclosed (International SOS is private); India entity revenue unknown [VERIFY via MCA/Tofler search for the Indian entity]. Ownership: reports in 2023–2025 that International SOS reviewed/divested the unit — status **unknown** [K-low] [VERIFY].
- Pricing model (industry pattern): per-eligible-cardholder annual fee plus per-request or per-minute charges, with SLA penalties; concierge staff in shared multilingual centres (Gurugram/Mumbai for India) [K-low] [VERIFY by asking a bank cards head or an ex-Aspire manager].

### 3.5 Ultra-boutique and boutique B2C operators (price anchors)

| Operator | Base / founder | Model | Reported price | Scale | Tag |
|---|---|---|---|---|---|
| **Sienna Charles** | US (New York/Miami); Jaclyn Sienna India; founded c.2007–2008 | Ultra-bespoke travel and lifestyle for a few dozen US$100m+ families; deliberately capped | ~US$150,000+/yr minimum | Tens of clients | [K-med] [VERIFY: Forbes/Bloomberg/Robb Report profiles 2022–2025] |
| **Knightsbridge Circle** | London; Stuart McNeill; founded 2012–2013 | Capped, ultra-high-touch membership; "the world's most expensive concierge" positioning | ~£25,000/yr | Low hundreds of members at most | [K-med] [VERIFY: knightsbridgecircle.com; Telegraph/FT profiles] |
| **Quintessentially** | London; 2000 | Tiered membership + corporate | £2k / £7k+VAT / £25–27.5k+VAT | Private paying members in the low thousands (UK) [K-low] | [E] |
| **Velocity Black** (pre-2023) | London/US; 2014 | App membership | ~US$2,000–3,500/yr | Tens of thousands [K-low] | [K-med] |
| **Bon Vivant** | London; Emyr Thomas; c.2008 | Boutique lifestyle/travel; bespoke retainers | High-four to five figures £ per year | Small | [K-low] [VERIFY] |
| **Innerplace** | London; mid-2000s | Nightlife/dining/events-led membership | ~£1,000–3,000/yr | Small | [K-low] [VERIFY] |
| **Nota Bene** | London; Anthony Lassman; 2004 | Editorial travel intelligence + bespoke planning; membership plus planning fees | Several £ thousand/yr plus fees | Small, affluent | [K-med for existence; K-low for price] [VERIFY] |
| **Element Lifestyle** | London (Kensington) | Tiered lifestyle management | Tiered, £ thousands | Small | [K-low] [VERIFY] |
| **Luxury Attaché** | New York; c.2003–2005 | Lifestyle management for executives plus residential-building and corporate concierge (B2B2C) | Tiered | Small | [K-low] [VERIFY] |
| **One Concierge** | US (Miami); c.2009 | Membership tiers plus à-la-carte and white-label | ~US$1,000 to US$10,000+/yr | Small | [K-low] [VERIFY] |
| **Essentialist** | US/Spain; Joan Roca; 2017 | App-based travel-design membership with a network of destination experts; venture-funded | ~US$1,000–1,500/yr | Thousands of members at peak; reported wind-down/restructuring c.2023–2024 | [K-low] [VERIFY: Crunchbase; Skift coverage] |
| **American Express Centurion** | Amex; in-house | Card + concierge + events; invitation only | US: US$10,000 initiation + US$5,000/yr (since 2020); UK/UAE/India fees differ; India Platinum Charge ~₹60,000 + GST | Global cardholder base undisclosed (order of 100k) | [K-med for US fees; K-low for India Centurion fee] [VERIFY on americanexpress.com/in] |

**Pattern:** ultra-boutiques cap membership at tens to low hundreds and price at US$25k–150k+; they are lifestyle businesses for their founders, not venture assets. The scalable end (Velocity Black, Ten, Aspire) sells to card issuers. The middle (Quintessentially) is where brand is strong and economics have been weakest [EST].

### 3.6 Card-benefit concierge platforms (who serves Mastercard/Visa/Amex)

| Programme | Operator(s) (by region) | India specifics | Tag |
|---|---|---|---|
| Mastercard Priceless / World Elite concierge | Outsourced by region; Ten in parts of Europe/Americas; Aspire in parts of APAC; John Paul in France/MEA; regional vendors elsewhere | Indian issuers' Mastercard World/World Elite cards route to the issuer's own vendor (often Aspire); Mastercard India also runs "Priceless" experiences marketing | [K-low] [VERIFY with Mastercard India and card T&Cs] |
| Visa Infinite / Signature concierge | Aspire Lifestyles across much of APAC (documented for HSBC Visa Infinite in India) [E]; other vendors by market | HDFC Infinia (Visa/Mastercard/Diners variants) via International SOS/Aspire [E]; ICICI Emeralde, Axis Burgundy Private, SBI Aurum operators **unknown** [E negative finding] | [E/K-low] [VERIFY each card's concierge T&C PDF] |
| American Express Platinum/Centurion | In-house Amex concierge centres (India served from Gurugram) | Platinum Charge concierge free with the card; Centurion invitation-only | [K-med] [VERIFY] |
| Diners Club (HDFC Diners Black) | Issuer-selected vendor (Aspire/ISOS per HDFC T&C) | Same vendor as Infinia | [E: HDFC T&C names International SOS] |

**What a bank pays (order of magnitude, for the model) [K-low] [VERIFY with a bank]:** US$0.5–3 per eligible premium card per year for a basic concierge line, or US$10–40 per request for usage-priced programmes, plus set-up fees; a fully digital programme for ~1m premium clients (Ten's 2024–25 win) implies annual net revenue in the £2m+ "Large contract" band, i.e., ~£2–5 per eligible member [EST from E].

---

## 4. Failures and cautionary tales

| Company | Model | Funding (approx.) | What happened | Root cause | Tag |
|---|---|---|---|---|---|
| **Magic** (US, 2015) | SMS "anything" concierge; later Magic+ at US$100/hr | ~US$12m (Sequoia) | Consumer product shrank; pivoted to a B2B virtual-assistant outsourcing business (still trading) | Fee per request < human cost per request; no supplier margin on small orders | [K-med] [VERIFY] |
| **GoButler** (Berlin/NY, 2015) | Free/low-cost text concierge | ~US$8m | Shut consumer concierge within ~12 months; pivoted to Angel.ai (AI for messaging) | Zero revenue per request; labour cost; hoped-for supplier commissions did not cover it | [K-med] [VERIFY] |
| **Operator** (US, 2015; Garrett Camp) | Chat commerce with human "operators" | ~US$10m+ | Closed 2017 | Same: commerce margins could not fund human intermediation | [K-med] [VERIFY] |
| **Luxe Valet** (US, 2013) | On-demand valet parking (adjacent "convenience" service) | ~US$75m | Sold to Volvo Cars 2017 after retreat from cities | Unit cost of labour per transaction; peak-hour demand curve | [K-med] [VERIFY] |
| **Hello Alfred** (US, 2014) | In-home weekly "butler"/home manager | ~US$50m+ | Pivoted from consumer to B2B for multifamily landlords; layoffs 2023; scaled down | Consumer willingness to pay < service cost; landlord channel lower margin | [K-low] [VERIFY] |
| **Fancy Hands** (US, 2010) | Micro-task virtual assistant subscription | Small | Survives at small scale; never scaled | Low ARPU; commoditised by AI assistants | [K-low] |
| **Zirtual** (US, 2011) | Dedicated virtual assistants by subscription | ~US$5m | Abrupt shutdown Aug 2015 (~400 staff laid off overnight); assets sold to Startups.co | Cash mismanagement; converted contractors to employees, cost base outran revenue | [K-med] [VERIFY] |
| **Essentialist** (2017) | Travel-design membership app | ~US$5–8m | Reported wind-down/restructuring 2023–2024 | Travel-only ARPU of ~US$1,000 cannot fund expert humans plus app development; COVID timing | [K-low] [VERIFY] |
| **Quintessentially sister businesses** (UK, 2005–2022) | Travel, Events, Estates, Wine, Art, Education, Publishing, People | Founder/shareholder funded | Most closed, sold or spun out 2016–2022; core business restated accounts, unlawful dividends, HMRC arrears, going-concern language, change of control 2024–25 | Sprawl before profitability; London fixed costs; governance | [K-med/K-low] [VERIFY Companies House] |
| **John Paul** (France, inside Accor) | White-label card concierge | Acquired for ~€150m/80% | Impaired; deprioritised; disposal reported | Integration failure; contract concentration; labour intensity | [K-low] [VERIFY] |
| **Velocity Black** | App concierge | ~US$40–60m | Not a failure — sold for a reported ~US$300m — but never disclosed profitability; the standalone brand faded post-deal | Heavy CAC and human cost funded by venture money until a strategic bought it | [K-med/K-low] [VERIFY] |
| **Inspirato** (US; luxury travel subscription; Nasdaq via SPAC 2022) | Subscription to luxury homes/hotels; "Inspirato Pass" | SPAC at ~US$1.1bn EV | Shares fell >90%; losses; recapitalised 2024 | Fixed lease costs vs subscription revenue; churn on Pass | [K-med] [VERIFY: Inspirato 10-K 2023–2024] |
| **DreamFolks** (India; lounge-access aggregator) | B2B benefits aggregator | Listed 2022 | Revenue -49% FY26, PAT -82% after ICICI/Axis/IDFC First changed lounge programmes; exited domestic lounges Sep 2025 | ~90% revenue from one benefit type sold to a few banks | [E: competitive-landscape Block 12] |
| **Dunzo** (India, 2015) | Began as a WhatsApp "do anything" concierge in Bengaluru; pivoted to hyperlocal delivery | ~US$450m+ (Reliance, Google) | Concierge model abandoned early because human errand economics failed; delivery business collapsed 2023–2024 | Per-task human cost; no willingness to pay for convenience at mass-market prices | [K-med] [VERIFY] |
| **Lookup / Goodservice / Helpchat** (India, 2015–2016) | Chat-based consumer concierge | US$1–5m each | Shut or pivoted within 18 months; Haptik (chat concierge origin) pivoted to enterprise chatbots and sold to Reliance Jio (2019, ~₹700 Cr reported) | Free/cheap concierge to the mass market cannot fund humans; the enterprise pivot was the only exit | [K-med] [VERIFY: Inc42/ET archives] |

**Cross-cutting causes (for the risk section of the plan):**
1. **Fee < fully loaded labour cost per request** whenever ARPU is below ~US$1,000/yr and requests are unbounded [K-med].
2. **Labour intensity does not fall with scale** unless tech changes the members-per-manager ratio; venture money masks this for 2–4 years [K-med].
3. **Churn concentrates in low-usage, gifted and entry-tier members**; "members served" overstates paying base (Indulge: 1,000+ "served" vs 183 paying) [E: Indulge notes B].
4. **Supplier dependence:** commissions rely on consortium/agency status; restaurant "access" is relationships, not contracts; bank programmes are re-tendered [K-med].
5. **Governance and cash discipline** (Quintessentially, Zirtual) sink brands that had demand [K-med].
6. **AI disintermediation:** since 2024, LLM agents handle the transactional tail (bookings, research) — the paid-for human layer must move up to judgment, access and trust [K-med].

---

## 5. M&A and valuation benchmarks

### 5.1 Transactions

| Year | Target | Acquirer | Price / structure | Target scale | Implied multiple | Why the buyer paid | Tag |
|---|---|---|---|---|---|---|---|
| 2016 | John Paul (80%) | Accor | ~€150m for 80% (~€190m for 100%) | ~€30–50m revenue; ~1,000 staff | ~4–6x revenue | Loyalty/CX capability, card-issuer distribution | [K-med price; K-low revenue] [VERIFY Accor Nov 2016 release] |
| 2017 | Ten Lifestyle Group IPO | AIM investors | 163p; ~£40m raised; ~£130m cap | ~£32m net revenue (FY2017) | ~4x revenue | Platform growth narrative | [K-med] [VERIFY] |
| 2019 | Resy (restaurant reservations) | American Express | Undisclosed | Reservation platform | n/a | Dining access for Platinum/Centurion members | [K-high deal; K-low terms] |
| 2019 | Haptik (chat concierge → enterprise AI) | Reliance Jio | ~₹700 Cr (~US$100m) reported | Enterprise chatbot vendor | n/a | AI/conversational capability | [K-med] [VERIFY] |
| 2020–2022 | cxLoyalty (2020), The Infatuation (2021), Frosch luxury travel agency (2022) | JPMorgan Chase | Undisclosed (Frosch reportedly a large nine-figure deal) | Frosch ~US$2bn annual travel sales | n/a | Building Chase Travel and dining content in-house | [K-med] [VERIFY] |
| 2021 | Lola.com, Freebird; Hopper (investment) | Capital One | Undisclosed / US$96m+ into Hopper | Travel tech | n/a | Capital One Travel platform | [K-med] [VERIFY] |
| 2023 | Velocity Black | Capital One | Reported ~US$300m | Revenue plausibly US$20–40m; tens of thousands of members | Plausibly 7–15x revenue | Chat concierge tech + affluent member base + supplier network for premium cards | [K-med deal; K-low price/multiple] [VERIFY] |
| 2024 | Tock (reservations/events) | American Express (from Squarespace) | US$400m | Reservations platform | n/a | Dining access, again | [K-high] |
| 2024–2025 | Quintessentially (change of control) | Unknown | Unknown | ~£15–25m turnover | Unknown | Brand + member base; distressed | [K-low] [VERIFY Companies House PSC] |
| 2025 | Soho House & Co (take-private) | MCR Hotels-led consortium | ~US$9/share; ~US$2.7bn EV | ~US$1.2bn revenue; ~270k members | ~2x revenue; mid-teens x EBITDA | Membership community with pricing power | [K-med] [VERIFY: SHCO 8-K Aug 2025] |
| 2022 | Inspirato (SPAC) | Public markets | ~US$1.1bn EV at listing → <US$100m by 2024 | ~US$300m+ revenue | 3x → <0.3x revenue | Subscription-travel narrative that broke | [K-med] [VERIFY] |
| 2022 | DreamFolks IPO | NSE/BSE | ~₹562 Cr issue at ₹326/share; ~₹1,700 Cr cap | ₹283 Cr revenue FY22 (₹773 Cr FY23) | ~6x FY22 revenue; ~30x earnings at peak | Aggregator narrative; collapsed 2025 | [K-med] [VERIFY: DRHP and price history] |
| 2025 | Indulge Global (angel round) | Manipal Group's Gautham Pai, Nikhil Shettar, others | US$1m; post-money ~₹50–56 Cr | ~₹2.1 Cr run-rate revenue; 183 paying members | ~25x run-rate revenue | Early-stage optionality | [E: Indulge notes B; competitive-landscape Blocks 7, 11] |

### 5.2 What acquirers actually buy (and the implications for an Indian founder)

1. **Card issuers buy access and content** (Amex: Resy, Tock; Chase: Frosch, Infatuation; Capital One: Velocity Black, Hopper stake) to differentiate premium cards whose annual fees (US$695–895 for Platinum-class cards, 2024–2025) are justified by benefits [K-med]. Indian analogues with the balance sheet and motive: HDFC Bank, ICICI, Axis, SBI Card, Kotak, IndusInd, Amex India — and increasingly wealth platforms (360 ONE, Kotak Private, Nuvama, Avendus) [K-med].
2. **Hotel/travel groups buy loyalty and distribution** (Accor/John Paul) — and struggle with it.
3. **Financial buyers are scarce**; the only PE-style outcomes are in adjacent benefits platforms (Collinson/Priority Pass-type assets) and members' clubs (Soho House) [K-med].
4. **Multiples:** growth-narrative or strategic: **4–8x revenue** (John Paul, Ten IPO, Velocity Black); steady-state: **1–2x revenue, 5–10x EBITDA** (Ten trading, Soho House take-private); distressed: sub-1x (Quintessentially, Inspirato) [EST from the above].
5. **What makes the multiple:** (a) owned member relationships and data (not a bank's members), (b) tech that changes members-per-manager, (c) contracted supply (rates, allocations, access), (d) recurring B2B contracts with multi-year terms, (e) audited numbers and clean governance [EST].

### 5.3 Public comps to track

| Ticker | Company | Why it matters | Tag |
|---|---|---|---|
| LSE AIM: TENG | Ten Lifestyle Group plc | The direct comp (B2B concierge platform) | [E] |
| NSE: DREAMFOLKS | DreamFolks Services Ltd | Indian card-benefit aggregator; concentration risk case | [E] |
| NYSE: SHCO (delisted 2025 on take-private) | Soho House & Co | Membership economics and retention benchmarks (members ~270k; retention ~90%+; membership revenue ~1/3 of total) | [K-med] [VERIFY 10-K 2024] |
| Nasdaq: ISPO | Inspirato | Subscription luxury travel; cautionary | [K-med] |
| Euronext: AC | Accor | John Paul owner (immaterial to Accor) | [K-high] |
| NYSE: COF | Capital One | Velocity Black owner (immaterial) | [K-high] |
| NYSE: AXP | American Express | Centurion/Platinum economics; Resy/Tock | [K-high] |
| Private | International SOS (Aspire), Collinson (Priority Pass), Quintessentially, John Paul, Virtuoso | Trade sources only | [K-med] |

---

## 6. Unit-economics benchmarks

### 6.1 Revenue per member and revenue mix

| Metric | Benchmark | Basis | Tag |
|---|---|---|---|
| B2B net revenue per **active** member per year | ≈ £180 (≈ US$230; ≈ ₹19,000) | Ten FY2024: £62.9m / 349k | [EST from E] |
| B2B corporate fee per active member | ≈ £158 | £55.3m / 349k | [EST from E] |
| B2B supplier revenue per active member | ≈ £22; supplier revenue = 12% of net revenue | £7.6m / 349k | [EST from E] |
| B2B revenue per **eligible** member (member with access) | Pence to low £ per year (active rate typically 5–15% of eligible) | Ten: "millions" with access vs 349k active | [K-low] [VERIFY active/eligible ratio] |
| B2C entry tier ARPU | US$1,000–3,500 (Essentialist, Velocity Black, Quintessentially Devoted, Innerplace); India ₹50,000 (Indulge Blue) | Section 3 | [E/K-med] |
| B2C dedicated/named-manager tier ARPU | £7,000 + VAT (Quintessentially Dedicated); ₹4 lakh (Indulge flagship); ₹3.5–5 lakh (Quintessentially India basic, 2013 figures); RedBeryl ₹5 lakh joining + ₹1.9 lakh/yr | Evidence files | [E] [VERIFY India figures for currency of data] |
| B2C elite tier ARPU | £25,000–27,500 + VAT (Quintessentially Elite); ~£25,000 (Knightsbridge Circle); ₹15–35 lakh (Quintessentially India elite, 2013) | Evidence + K-med | [E/K-med] |
| Ultra-boutique | US$150,000+ (Sienna Charles) | K-med | [K-med] [VERIFY] |
| Member GMV routed through the concierge | Indulge: "average client billing" ₹5 → ₹8 lakh/yr, i.e., ~2x the fee, best read as spend routed through the service, not revenue; Quintessentially Elite household: £150–300k/yr | Indulge notes A; EST | [E-derived / EST] |
| Blended supplier take on routed GMV | 3–8% for a B2C concierge (mix of commissionable hotels/villas/yachts and non-commissionable restaurants/retail/flights) | Commission table below | [EST] |
| Revenue mix — B2B platform (Ten) | Corporate fees 88% / supplier 12% | [E] | [E] |
| Revenue mix — B2C membership operator (Quintessentially-type) | Fees 45–60%; corporate/white-label 20–35%; commissions/mark-ups 10–20%; licences 3–8%; events <5% | Quintessentially note §4 | [EST] |
| Revenue mix — Indulge (FY25-26) | Fees 75–85%; request/expense-linked 5–15%; marketplace 5–10%; other <5% | Indulge notes A | [EST from E] |

### 6.2 Cost side: labour ratios and staffing

| Metric | Benchmark | Basis | Tag |
|---|---|---|---|
| Payroll as % of revenue (company level) | ~50% (Indulge, Shark Tank disclosure); 45–60% typical for human-led concierge | [E: Indulge notes A/B]; EST | [E/EST] |
| Lifestyle manager (LM) : member ratio — pooled/digital B2B | ~1:300–500 active members per LM (Ten: 349k active / plausibly 700–1,000 front-line staff) | EST from E + K-low headcount | [EST] [VERIFY Ten headcount] |
| LM : member — entry B2C tier (app + shared team) | 1:100–200 | Quintessentially note §5 | [EST] |
| LM : member — dedicated/named-manager tier | 1:20–40 (Indulge: 15 managers for 350+ clients ≈ 1:23 in 2023; pod of 6–7 staff per member group) | [E: Indulge notes A] | [E/EST] |
| LM : member — elite tier | 1:5–10 (a small pod per household) | EST | [EST] |
| Fully loaded LM cost | India ₹6–12 lakh/yr (Goa/Hyderabad/Gurugram; Indulge implies ~₹6L average across a 30-person team); UK £40–70k; US US$60–90k; Dubai AED 180–300k | [E: Indulge ~₹15L/month payroll ÷ 30] ; EST | [E-derived/EST] |
| 24/7 coverage overhead | Follow-the-sun needs 4.5–5 FTE per 24/7 seat; a minimum viable 24/7 desk is 6–8 staff | Standard workforce arithmetic | [K-high] |
| Requests per B2C member per month | 3–5 (Indulge: ~16,000 requests over ~18 months across 180–350 clients) ; elite households 8–15; entry tier 0.5–2 | [E-derived: Indulge notes A]; EST | [E-derived/EST] |
| Requests per active B2B member per year | Order of 3–8 (Ten's "active" definition implies ≥1) | K-low | [K-low] [VERIFY] |
| Handling time per request | Simple (table, car, ticket) 15–45 min; travel itinerary 3–10 hours; complex sourcing days | Industry practice | [K-med] |
| Implied labour cost per request (India) | ₹300–1,500 simple; ₹5,000–15,000 itinerary | ₹8L LM ÷ ~1,800 productive hours ≈ ₹450/hr | [EST] |
| Tech spend | Ten: ~12–15% of net revenue capitalised (K-low); Indian WhatsApp-first operator: <5% (Indulge, inference) | [K-low / E-inference] | [VERIFY] |

### 6.3 Retention, acquisition and margin

| Metric | Benchmark | Basis | Tag |
|---|---|---|---|
| Annual churn — B2C entry tier | 25–40% | Industry pattern; low-usage members do not renew | [K-low/EST] |
| Annual churn — dedicated tier | 15–25% | | [K-low/EST] |
| Annual churn — elite tier | <15% (LM attrition is the hidden driver) | | [K-low/EST] |
| Members' club retention (for calibration) | ~90%+ (Soho House reported retention in the low-to-mid 90s%) | [K-med] [VERIFY 10-K] | [K-med] |
| B2B contract renewal | High (>85–90% by value) but lumpy; a single re-tender can remove 10–30% of revenue (DreamFolks: ~90%) | Ten pattern; [E: DreamFolks] | [K-low/E] |
| CAC — B2C | UK £1,000–3,000 per member (referral, events, PR); India ₹25,000–1,00,000 per ₹4 lakh member (events, referral incentives, sales headcount) ; Velocity Black-style paid digital acquisition can exceed a year's fee | EST | [EST] |
| Payback | <1 year for dedicated/elite (fee paid upfront); 1–2 years for entry tier | EST | [EST] |
| Gross margin — membership fees (LM labour in cost of service) | Elite 50–65%; dedicated 65–75%; pooled 70–80%; company-level 40–55% after 24/7 overhead and lower tiers | Quintessentially note §5; Indulge 50% payroll | [EST/E] |
| Gross margin — supplier commissions | 85–95% (cost = booking-desk time) | | [EST] |
| Gross margin — events/experiences | 15–30% (sponsorship offsets) | | [K-med] |
| Gross margin — collectibles/marketplace | 10–30% | Pre-owned luxury dealer norms | [K-med] |
| Gross margin — B2B per-member programmes | 40–50% after service staff (Ten-type) ; adjusted EBITDA margin high-teens % at £60m+ scale | [K-low] | [VERIFY] |
| Net margin claimed by Indulge | ₹60 lakh on ₹2.1 Cr (7 months) ≈ 29% — unaudited | [E: Indulge notes A] | [E] |

### 6.4 Supplier commission rates (what the supply side pays a concierge/agent)

| Category | Typical commission / margin | Mechanism | India notes | Tag |
|---|---|---|---|---|
| Hotels (luxury, via consortia: Virtuoso, Serandipians, Signature) | **10%** of room revenue (some 12%); plus member amenities | Paid by hotel to the IATA/consortium agency; 30–90 day lag; non-commissionable rates exist | Indian luxury hotels (Oberoi, Taj, Leela, Aman-i-Khas, Six Senses) pay agency commission through GDS/consortia; direct "concierge rate" deals possible | [K-med] [VERIFY with a Virtuoso agency] |
| Hotels (direct contract) | 8–15%, or net rates marked up | Bilateral | Common in India via DMCs | [K-med] |
| Villas / private homes | **10–20%** (15% common) | Villa agencies and owners | Goa/Alibaug villa platforms pay 10–15% | [K-med] |
| Tour operators / DMCs (packaged itineraries) | 10–20% margin on package | Net rates + mark-up | Indian outbound DMCs give 8–15% | [K-med] |
| Airlines (scheduled tickets) | ~0–1% (near zero; service fee model) | Commission largely abolished | Charge a service fee | [K-high] |
| Private jets (charter broker) | **5–10%** broker margin (some 10–15% on empty legs) | Broker marks up operator price | Indian charter brokers (JetSetGo, BookMyCharters) work on 5–10% | [K-med] |
| Yachts (charter) | **10–20%**; MYBA standard 15% total, split retail/central agent (retail ~10–15%) | Paid by owner via central agent | Limited Indian supply; Med/Maldives charters via brokers | [K-med] [VERIFY MYBA terms] |
| Restaurants | **0–10%**; mostly 0; private dining/events 10%; per-cover fees (£5–15) in some cities | Relationship-based | Indian restaurants pay ~0; some pay for group bookings | [K-med] |
| Tickets / hospitality (sport, concerts, F1, Wimbledon) | 10–30% mark-up on hospitality packages; secondary-market spreads higher | Broker/reseller | IPL/ICC hospitality via official packages; resale legal grey area | [K-med] |
| Luxury retail / personal shopping | 5–12% (brand affiliate or shopper's fee); grey-market watches 5–15% | Brand programmes, resellers | Indian boutiques rarely pay; sourcing fees charged to member | [K-med] |
| Art / collectibles advisory | 5–10% buyer's advisory fee; auction-house intro fees | Fee to client | Same | [K-med] |
| Wine | 10–15% | Merchants | Restricted in India | [K-med] |
| Real estate (buy-side) | **1–2%** brokerage (India: 1–2% each side; UK buying agents 1–2.5% + retainer) | Fee | RERA-registered agents only | [K-med] |
| Insurance (travel/health) | 10–15% | Agency licence needed (IRDAI in India) | Corporate agent licence or partner | [K-med] |
| Wellness retreats / spas | 10–15% | Direct | Ananda, Vana-type pay agency commission | [K-med] |
| Car rental / chauffeur | 5–10% | Direct | Indian operators pay 5–10% | [K-med] |
| Education / relocation / immigration consultants | 10–20% referral | Referral agreements | Common | [K-low] |
| Private banks / wealth managers (referral) | Prohibited or tightly regulated; do not model | — | SEBI/RBI rules | [K-med] |

**GST note (India):** commissions earned from Indian suppliers attract 18% GST; foreign-supplier commissions may qualify as export of services subject to conditions; membership fees attract 18% GST; overseas tour packages sold by an Indian entity are subject to TCS under s.206C(1G) (rate schedule revised in Finance Act 2023/2025) [K-med] [VERIFY with a CA; see the regulatory research document].

### 6.5 Plug-in benchmark table for the financial model

Columns: metric | default value to use | range | source | confidence. Values are for an India-based business with a global-Indian corridor; adjust per city.

| # | Model line | Default | Range | Source | Confidence |
|---|---|---|---|---|---|
| 1 | Entry/app tier fee (₹/yr) | 60,000 | 50,000–1,00,000 | Indulge Blue ₹50k [E]; Indulge legacy ₹1L + 5% [E] | E |
| 2 | Named-manager tier fee (₹/yr) | 4,50,000 | 3,50,000–6,00,000 | Indulge ₹4L [E]; Quintessentially India ₹3.5–5L (2013) [E] | E (dated) |
| 3 | Elite/family tier fee (₹/yr) | 15,00,000 | 12,00,000–25,00,000 | Quintessentially India ₹15–35L (2013) [E]; UK £25–27.5k [E] | E (dated) |
| 4 | Joining fee (elite/card-style) | 0 (option 2–5 lakh) | 0–5,00,000 | RedBeryl ₹5L joining + ₹1.9L annual [E] | E |
| 5 | Global-Indian (NRI) tier fee | US$8,000 | US$5,000–15,000 | Quintessentially Dedicated £7k+VAT [E]; Velocity Black US$2–3.5k [K-low] | K-med |
| 6 | B2B white-label: fee per active member/yr | ₹15,000 | ₹8,000–20,000 | Ten ≈ £180/active member [E-derived], scaled to Indian cost base | EST |
| 7 | B2B white-label: fee per eligible member/yr | ₹100 | ₹40–250 | Card-programme norms US$0.5–3 [K-low] | K-low |
| 8 | B2B per-request fee | ₹1,200 | ₹800–3,000 | US$10–40 industry [K-low]; India labour cost | K-low |
| 9 | Member GMV routed via concierge (named tier) | ₹8,00,000 | 4,00,000–15,00,000 | Indulge "average client billing" ₹8L [E-derived] | E-derived |
| 10 | Member GMV (elite tier) | ₹40,00,000 | 20,00,000–1,00,00,000 | Quintessentially Elite £150–300k [EST] scaled | EST |
| 11 | Blended supplier take on GMV | 5% | 3–8% | §6.4 mix | EST |
| 12 | Supplier revenue as % of total net revenue (B2B) | 12% | 8–15% | Ten FY2024 [E] | E |
| 13 | Requests per member per month (named tier) | 4 | 3–5 | Indulge volumes [E-derived] | E-derived |
| 14 | Requests per member per month (elite) | 10 | 8–15 | EST | EST |
| 15 | Requests per member per month (entry) | 1 | 0.5–2 | EST | EST |
| 16 | LM : member ratio (entry) | 1:120 | 1:100–200 | Quintessentially note [EST] | EST |
| 17 | LM : member ratio (named) | 1:25 | 1:20–40 | Indulge 1:23 [E] | E |
| 18 | LM : member ratio (elite) | 1:8 | 1:5–10 | EST | EST |
| 19 | LM fully loaded cost (₹/yr, India) | 9,00,000 | 6,00,000–12,00,000 | Indulge payroll [E-derived]; market rates | E-derived |
| 20 | LM fully loaded cost (Dubai/London seat) | £55,000 / AED 240k | £40–70k / AED 180–300k | EST | EST |
| 21 | 24/7 desk minimum headcount | 7 | 6–8 | Workforce arithmetic | K-high |
| 22 | Payroll % of revenue at scale | 50% | 45–60% | Indulge [E]; Quintessentially/Ten structure | E/EST |
| 23 | Tech and product spend % of revenue | 8% | 5–15% | Ten 12–15% (capitalised) [K-low]; Indian start-up 5% | K-low |
| 24 | Churn — entry tier | 35% | 25–40% | Industry pattern | K-low |
| 25 | Churn — named tier | 20% | 15–25% | Industry pattern | K-low |
| 26 | Churn — elite tier | 10% | 5–15% | Industry pattern; Soho House ~90%+ retention [K-med] | K-low |
| 27 | CAC — named tier (₹) | 60,000 | 25,000–1,00,000 | EST | EST |
| 28 | CAC — elite tier (₹) | 2,00,000 | 1,00,000–4,00,000 | EST (dinners, gifts, referral fees) | EST |
| 29 | B2B contract term | 3 years | 2–5 | Ten pattern [K-med] | K-med |
| 30 | B2B revenue concentration cap (policy) | ≤30% from one client | — | DreamFolks lesson [E]; Ten risk register [K-med] | E/K-med |
| 31 | Gross margin — fees (LM labour in COGS) | 60% | 45–75% | §6.3 | EST |
| 32 | Gross margin — commissions | 90% | 85–95% | §6.3 | EST |
| 33 | Gross margin — events | 25% | 15–30% | §6.3 | K-med |
| 34 | Gross margin — marketplace | 20% | 10–30% | Pre-owned luxury norms | K-med |
| 35 | Adjusted EBITDA margin at scale (B2B-heavy) | 18% | 10–20% | Ten FY2024 ~19% [K-low] | K-low |
| 36 | Valuation multiple — strategic exit | 4x revenue | 3–8x | John Paul, Ten IPO, Velocity Black [K-med/K-low] | K-low |
| 37 | Valuation multiple — steady state | 1.2x revenue / 6x EBITDA | 0.8–2x / 5–10x | Ten trading; Soho House [K-low/K-med] | K-low |
| 38 | Early-stage angel multiple (India) | 25x run-rate | — | Indulge ₹50–56 Cr on ₹2.1 Cr [E] | E |
| 39 | GST on fees and commissions | 18% | — | CGST Act; [VERIFY] | K-med |
| 40 | Active/eligible ratio (B2B) | 10% | 5–15% | Ten "millions" vs 349k [E]; K-low | K-low |

---

## 7. Implications for the India model (one page)

1. **Build three revenue engines, model them separately:** membership fees (60–75% of revenue in years 1–3), supplier commissions on routed GMV (10–20%), B2B white-label (0% in year 1 rising to 20–35% if one private bank/developer is signed). Ten proves the B2B constant (~₹19k net revenue per active member); Quintessentially/Indulge prove the fee ladder [E].
2. **Price the named-manager tier at ₹4–6 lakh and the elite tier at ₹12–25 lakh**, above Indulge and below imported Quintessentially Elite [E]; use a ₹50k–1 lakh entry tier only as a funnel with a hard usage cap (entry tiers are where global failures happened) [K-med].
3. **Staff to ratios, not to headcount:** 1:25 named, 1:8 elite, with a 7-person 24/7 core; the model should show payroll ≤ 50% of revenue by year 3 [E/EST].
4. **Join a consortium or partner with a Virtuoso/Serandipians agency in year 1** so hotel/villa commissions (10–15%) are earned legitimately; disclose the policy — Indian investors will ask (Anupam Mittal's question to Indulge) [E].
5. **Cap any single B2B client at ~30% of revenue** and sign 3-year terms; DreamFolks is the Indian precedent for what happens otherwise [E].
6. **Spend on tech that changes the ratio** (WhatsApp Business API + CRM + AI triage/drafting + supplier tooling), budgeted at 5–8% of revenue; do not claim a platform multiple without it [K-low/EST].
7. **Governance from day one** (audited accounts, no founder withdrawals ahead of reserves, clean MCA filings): the category's global leader lost a decade to the opposite [K-med].
8. **Exit thesis:** a bank/card issuer, wealth platform or hotel group buying members + tech + supply at 3–6x revenue; build the data architecture and contracts so that the member relationship is owned by the company, not by individual lifestyle managers or a bank partner [EST].

---

## Sources and evidence

**Evidence files on disk (live-captured; URLs as captured):**
- `raw-notes/live-search-dump-competitive-landscape-india.md` — Block 4 (Ten contracts: DNB, 1m-member digital programme, HSBC/Coutts/RBC/Westpac, three regions): https://www.marketscreener.com/quote/stock/TEN-LIFESTYLE-GROUP-PLC-38804818/news/Ten-Lifestyle-Expands-Concierge-Services-Contract-with-Norway-s-DNB-Bank-36916617/ ; https://www.tipranks.com/news/company-announcements/ten-lifestyle-group-wins-multi-year-digital-concierge-contract-with-major-bank ; https://tenlifestylegroup.com/what-ten-does/ ; https://en.wikipedia.org/wiki/Ten_Lifestyle_Group — Block 10 (Ten FY2024 net revenue £62.9m, corporate £55.3m, supplier £7.6m, 349,000 active members, 20+ service locations, B Corp): https://tenlifestylegroup.com/investors/ ; https://tenlifestylegroup.com/annual-report-accounts-2025/ ; https://tenlifestylegroup.com/wp-content/uploads/2025/11/Strategic-Report-Ten-Lifestyle-Group-Plc-Annual-Report-and-Accounts-2025_compressed.pdf ; https://tenlifestylegroup.com/wp-content/uploads/2025/11/TENG-full-year-2025-results-presentation-compressed.pdf ; https://tenlifestylegroup.com/wp-content/uploads/2024/11/ten-lifestyle-group-full-year-2024-Results-Presentation_131124.pdf ; https://tenlifestylegroup.com/wp-content/uploads/2023/12/ten-lifestyle-group-plc-annual-report-and-accounts-2023.pdf ; https://tenlifestylegroup.com/wp-content/uploads/2025/02/Investors_Capital_Market_Day_2025.pdf ; https://tenlifestylegroup.com/wp-content/uploads/2025/11/Financial-Statements-Ten-Lifestyle-Group-Plc-Annual-Report-and-Accounts-2025_compressed.pdf — Blocks 6 and 9 (Aspire Lifestyles/International SOS; HDFC Infinia and HSBC Visa Infinite concierge): https://www.aspirelifestyles.com/about/ ; https://www.aspirelifestyles.com/history/ ; https://infinitebutler.aspirelifestyles.com/ ; https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/discover-products/cards/credit-cards/infinia-credit-card/Concierge-T-and-C.pdf — Block 2 (Quintessentially India pricing): https://www.businesstoday.in/magazine/cover-story/story/concierge-services-for-the-wealthy-india-131514-2013-08-16 ; https://www.dezerv.in/blog/concierge-services/ — Block 8 (RedBeryl Red Card ₹5 lakh joining, ₹1.9 lakh annual): https://inc42.com/startups/how-this-ex-american-express-ceo-wants-to-change-the-luxury-concierge-paradigm-in-india/ ; https://redberyl.co/memberships — Blocks 7 and 11 (Indulge Shark Tank, revenue, funding): https://inc42.com/buzz/shark-tank-fame-indulge-global-bags-funding-to-offer-concierge-services/ ; https://tracxn.com/d/companies/indulge-global/__wdoOPUzoay6--H1zLKntvt3q9QZUhR6ZENBGbDuyYyw — Block 12 (DreamFolks FY25–FY26): https://en.wikipedia.org/wiki/DreamFolks ; https://biznewsbyjay.substack.com/p/17-why-did-89-of-dreamfolks-revenue ; https://retailintel.in/signal/dreamfolks-pivots-to-rail-lounges-and-lifestyle-benefits-aft-8ae4d84a
- `raw-notes/live-search-dump-initial-scouting.md` — Block 3 (Quintessentially UK 2026 tier pricing): https://quintessentially.com/membership ; https://stirlingaccess.com/compare/quintessentially/review ; https://thediscernedfew.com/journal/luxury-concierge-memberships-compared.php ; https://www.charitybuzz.com/catalog_items/auction-quintessentially-bespoke-elite-membership-for-1-560300
- `raw-notes/live-search-dump-indulge-global-model-ops.md` — Block 79 ("concierge services market US$751m in 2021, US$1.2bn by 2030" in Indulge launch PR, May 2023): https://www.business-standard.com/content/press-releases-ani/indulge-global-a-personalised-worldwide-concierge-launches-in-india-123052300308_1.html ; https://www.aninews.in/news/business/business/indulge-global-a-personalised-worldwide-concierge-launches-in-india20230522193835/ — Block 46 (Quora threads on Quintessentially, Element Lifestyle, Amex concierge): https://www.quora.com/Is-the-concierge-service-Quintessentially-worth-it-and-are-there-superior-alternatives
- `raw-notes/live-search-dump-indulge-global-facts-gtm.md` — lines 91–193 (Shark Tank ask ₹50 lakh for 1%; Tracxn valuation ₹56 Cr; cap table); lines 1686–1688 (Sharks' objections: valuation, scalability, commission transparency).
- `raw-notes/live-search-dump-india-wealth-market.md` — lines 255–287 (India luxury market estimates, Bain).
- `raw-notes/indulge-global-A-business-model-services-operations.md` and `...-B-company-facts-financials-gtm.md` — payroll ~50% of revenue; 15 managers for 350+ clients; 9,000 → 25,000 requests; ₹8 lakh average client billing; 183 paying customers; ₹2.1 Cr run-rate; ₹60 lakh claimed profit.
- `raw-notes/quintessentially-A-business-model-services-operations.md` — Quintessentially business-model, cost-structure and unit-economics estimates reused here.

**Named sources from analyst knowledge (not on disk; verify before citing):**
- Ten Lifestyle Group plc: AIM admission document (Nov 2017); Annual Report & Accounts FY2018–FY2025; half-year and full-year RNS announcements; Capital Markets Day 2025 deck; LSE/MarketScreener share-price history.
- Accor SA: press release on the acquisition of John Paul (Nov 2016); Registration Document 2016; Universal Registration Documents 2019–2024 (impairment/disposal notes); Les Echos coverage of John Paul.
- Capital One Financial: press release on the acquisition of Velocity Black (June 2023); Sky News/FT reports on price; Companies House filings for Velocity Black Ltd.
- Companies House (UK): Quintessentially (UK) Limited and related entities — accounts, filing history, PSC register; The Guardian (2021) on restated accounts/unlawful dividends; FT/Times 2022–2025.
- International SOS / Aspire Lifestyles corporate pages; Visa and Mastercard concierge programme pages by market; American Express India card T&Cs.
- Virtuoso press room (network sales, advisor counts); MYBA charter agreement norms; Serandipians/Signature/Ensemble membership pages.
- Soho House & Co Form 10-K (2024) and take-private 8-K (Aug 2025); Inspirato Form 10-K (2023–2024); DreamFolks DRHP (2022) and annual reports FY23–FY26; Reliance Jio–Haptik deal coverage (2019); Dunzo/Lookup/Goodservice coverage in Inc42/Economic Times (2015–2024).
- Vendor market reports (Grand View Research, Allied Market Research, Verified Market Research, IMARC, Market Research Future) — for order-of-magnitude citation only.

---

## Confidence & gaps

**High confidence (evidence-backed or stable facts):** Ten's FY2024 net revenue split and active-member count; Ten's client names, three regions, 20+ locations and B Corp status; Ten's founding (1998) and AIM listing (2017); Quintessentially's UK 2026 tier prices and India tier prices (dated 2013); RedBeryl's fee structure; Indulge's prices, revenue run-rate, paying-member count, valuation and funding; Aspire's India role (HDFC Infinia, HSBC); DreamFolks FY25–FY26 collapse; the fact of the Accor–John Paul (2016) and Capital One–Velocity Black (2023) transactions; Amex's acquisitions of Resy and Tock; the vendor "US$751m → US$1.2bn" claim as a claim.

**Medium confidence (likely right, details may be off):** Ten's contract-tier definitions and pricing components; John Paul's 80%/€150m price; Amex Centurion US fees; Sienna Charles and Knightsbridge Circle price points; supplier commission norms by category; the Indian cautionary tales (Dunzo origins, Haptik sale, Lookup/Goodservice closures); Soho House take-private terms; Inspirato's SPAC and collapse; failure causes for Magic/GoButler/Operator/Zirtual.

**Low confidence / unverified:** every Ten figure other than FY2024 (net revenue and EBITDA by year, gross-margin presentation, capitalised development, regional split, client concentration, headcount, share-price history); Velocity Black's price, revenue, member count and fee; John Paul's post-2019 fate and revenue; Quintessentially's turnover, losses, HMRC and change-of-control details; Aspire's ownership status and pricing; Essentialist's fate; Hello Alfred's current status; churn, CAC and requests-per-member ranges (analyst estimates); bank-side prices per eligible cardholder; active/eligible ratios.

**Could not establish (no evidence, no reliable recollection):** Ten's FY2025 exact results; any operator's audited India revenue other than Les Concierges (₹8.24 Cr FY25, in doc 06); Velocity Black's post-acquisition metrics; who bought Quintessentially and John Paul; Visa/Mastercard concierge vendor by Indian issuer beyond HDFC and HSBC; any operator's disclosed churn or CAC; Amex Centurion India fee.

---

## Verification list (do these first, in order of decision impact)

| # | Fact to verify | Why it matters | Where to verify |
|---|---|---|---|
| 1 | Ten FY2025 and FY2024 net revenue, corporate vs supplier split, adjusted EBITDA and margin, active members, members with access | Anchors the B2B constants (£180/active member; 12% supplier share; ~19% EBITDA margin) | Ten Annual Report & Accounts 2025 (Strategic Report and Financial Statements PDFs, URLs above); FY2025 results presentation |
| 2 | Ten net revenue and adjusted EBITDA FY2018–FY2023 | The growth/margin trajectory chart | Annual reports FY2018–FY2023 on tenlifestylegroup.com/investors/resources; RNS full-year results |
| 3 | Ten's contract-tier definitions (Large/Medium/Small), pricing components, typical term, top-client concentration, regional split | B2B pricing template and concentration policy | Annual report "Business model", "KPIs", "Principal risks" and segment/major-customer notes |
| 4 | Ten capitalised development spend and headcount | Tech-spend benchmark (% of revenue) and members-per-staff ratio | Annual report intangible-assets note; "Our people" section |
| 5 | Ten share-price/market-cap history (IPO price and cap; 2020 low; 2022–2025 range) | Steady-state valuation multiple | LSE website; MarketScreener; AIM admission document |
| 6 | Accor–John Paul: 80% stake, ~€150m, 2016 revenue/headcount; subsequent impairment and disposal | Strategic-exit multiple; integration lesson | Accor press release Nov 2016; Accor Registration Document 2016; URDs 2019–2024 |
| 7 | Capital One–Velocity Black: date, reported price, Velocity Black revenue/members/fee, funding raised | Card-issuer exit precedent and multiple | Capital One newsroom (June 2023); Sky News/FT; Companies House (Velocity Black Ltd) accounts; Wayback snapshots of velocityblack.com |
| 8 | Quintessentially (UK) Ltd turnover, losses, going-concern notes, unlawful-dividend restatement, HMRC arrears, 2024–25 change of control | The "why did the leader struggle" answer for investors | Companies House accounts and PSC register; The Guardian 2021; FT/Times 2024–25 |
| 9 | Quintessentially India current tier prices (the ₹3.5–5 lakh / ₹15–35 lakh figures are 2013-era) | Elite price ceiling in India | quintessentially.com/locations/india; call the Delhi office |
| 10 | Aspire Lifestyles ownership status (International SOS review/divestiture) and Indian bank clients beyond HDFC/HSBC; pricing per cardholder/request | B2B competitor and partner map; bank-side price benchmark | aspirelifestyles.com; ISOS group pages; card concierge T&C PDFs for ICICI Emeralde, Axis Burgundy Private, SBI Aurum, Kotak, IndusInd; an ex-Aspire manager |
| 11 | Amex Centurion/Platinum fees (US and India) and whether Amex India concierge is in-house | Card benchmark and the "free concierge" competitor | americanexpress.com/in; Amex Platinum Charge T&C |
| 12 | Supplier commission norms: Virtuoso hotel commission (10%), villa 10–20%, MYBA yacht 15% split, jet broker 5–10%, restaurants 0–10% | Commission revenue line | Virtuoso and Serandipians membership materials; MYBA charter agreement; a Virtuoso agency in Mumbai; JetSetGo/charter brokers |
| 13 | Virtuoso network sales (~US$30bn+) and advisor counts; India member agencies | Adjacent-market sizing and partner choice | virtuoso.com press room; advisor directory |
| 14 | The "US$751m (2021) → US$1.2bn (2030)" concierge market claim: vendor, definition, geography | Whether it can be cited at all | Trace via the ANI/Business Standard PR (URL above) to the vendor report; compare Grand View/Allied/IMARC briefs |
| 15 | Sienna Charles (~US$150k+/yr) and Knightsbridge Circle (~£25k/yr) price points and member caps | Ultra-tier price anchors | Founder interviews (Forbes, Bloomberg, Telegraph); company sites |
| 16 | Essentialist, Hello Alfred, Magic, GoButler, Operator, Zirtual outcomes and funding totals | Cautionary-tale slide accuracy | Crunchbase; TechCrunch/Skift archives |
| 17 | Dunzo's concierge origin and collapse; Haptik's sale price to Reliance Jio; Lookup/Goodservice closures | India-specific cautionary tales | Inc42, Economic Times, YourStory archives |
| 18 | DreamFolks FY26 revenue ₹660.6 Cr and PAT ₹11.6 Cr; bank programme changes and dates | Concentration-risk slide | DreamFolks FY26 annual report/results (May 2026); exchange filings |
| 19 | Soho House retention rate, membership revenue share and take-private terms; Inspirato SPAC value and collapse | Membership-economics calibration | SHCO 10-K 2024 and 8-K Aug 2025; ISPO 10-K |
| 20 | Indulge Global audited FY24/FY25 revenue, PAT and employee cost | The only Indian B2C P&L available for calibration | Tofler/Instafinancials paid report for Pricetime Technologies Pvt Ltd |
| 21 | Bank-side price per eligible premium cardholder and per request in India | B2B pricing model | Conversations with cards heads at 2–3 Indian banks; RFP documents if obtainable |
| 22 | GST treatment of membership fees and supplier commissions; TCS on overseas tour packages | Revenue and pricing lines | CA opinion; CBIC notifications; Finance Act 2025 s.206C(1G) |
| 23 | Whether any Indian private bank or developer currently white-labels a luxury concierge (and with whom) | B2B white space claim | Press releases of Kotak Private, 360 ONE, Axis Burgundy Private, DLF/Lodha/Oberoi Realty; card and wealth T&Cs |
