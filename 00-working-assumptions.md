# Working assumptions and founder decisions (binding for all plan documents)

Prepared 2026-09-17 by the lead analyst from the research base in `01-research/`. These are the decisions every downstream document (business model, financial model, business plan, deck, brand kit, outreach) must use so that the numbers and names agree everywhere. The founder can override any item; when one changes, the documents that depend on it are listed so they can be updated together.

## 1. What we are building (one paragraph)

An invitation-only luxury lifestyle-management and concierge company for Indian ultra-high-net-worth and very-high-net-worth families and global Indians, launched in India. It benchmarks four models: Indulge Global (WhatsApp-native, single ₹4 lakh tier), Quintessentially (global tiered lifestyle management plus corporate/white-label), American Express Centurion (fee-plus-spend "membership model" with partner-funded benefits and an in-house/outsourced concierge), and RedBeryl (invitation-only, joining-fee-led, partner-network benefits). The research concludes that the ₹2 to 5 lakh WhatsApp-pod band is crowded, that the ₹12 to 25 lakh dedicated-lifestyle-manager tier and the B2B "private overlay" for wealth managers, residences, clubs and brands are open in India, and that trust (published fee and commission policy, DPDP-grade discretion) and contracted peak-season access are unclaimed positions. The business-model stage must design within these findings but is free to choose the exact tier architecture.

## 2. Brand name

- **Working name: TBD — to be set from the naming study in `01-research/13-brand-identity-research.md` (top-ranked recommendation) once it is complete.** Until then documents may use the placeholder `[BRAND]`.
- **"Indulge" is NOT to be used as the brand.** Indulge Global (Pricetime Technologies Pvt Ltd) has operated under that name in India since 2022, owns indulge.global, and appeared on Shark Tank India; using it invites a passing-off/trademark dispute and customer confusion. The repository name "INDULGE" is a project codename only.
- Trademark clearance (classes 35, 39, 41, 43, 45) is required before any public use of the chosen name; see `05-brand-kit/naming-and-trademark.md` once written.

## 3. Geography and sequencing

- **Country: India. Entity: Private Limited company registered in Mumbai** (Maharashtra), with DPIIT Startup India recognition applied for at incorporation.
- **Launch city: Mumbai** (about 35% of India's UHNWIs; 451 of ~1,700 Hurun Rich List 2025 entrants) [research 05, 06].
- **City 2: Delhi NCR** within the first 12 months of launch (Mumbai plus Delhi NCR hold roughly 45% of the US$30M+ segment).
- **City 3: Bengaluru** in Year 2 (founder/ESOP wealth), then Hyderabad and Chennai opportunistically through partner channels.
- **Global-Indian corridor: one lifestyle-manager seat in Dubai in Year 2 and one in London in Year 3**, serving NRI members and Indian families travelling; no claims of "190+ countries" without staff or contracted partners.

## 4. Timeline and model calendar

- Company incorporation and pre-launch build: **October 2026 to March 2027 ("Year 0", six months)**: legal, brand, first hires, supplier network, founding-member recruitment, technology stack.
- **Soft launch with founding members: January 2027. Formal launch: April 2027.**
- **Financial model Year 1 = FY2027-28 (April 2027 to March 2028)**, Year 2 = FY2028-29, and so on to Year 5 = FY2031-32. The model shows Year 0 (Oct 2026 to Mar 2027) as a pre-launch period funded by the seed round. Monthly granularity for 66 months (Oct 2026 to Mar 2032).
- Indian financial-year conventions apply (April to March); all annual figures are FY figures.

## 5. Currency and number conventions

- **INR is the primary currency.** Show USD in brackets for investor readability.
- **Exchange rate convention: ₹87 = US$1** (the rate used across the research files; the market file notes press reports implying a weaker rupee in 2026, so mark the rate [VERIFY] and update the model input, never hard-code conversions).
- Annual figures in ₹ crore (Cr); monthly figures in ₹ lakh where clearer. 1 crore = 10 million = 100 lakh.
- GST at 18% on membership fees and service fees (shown as excluded from fees unless stated; prices to members are quoted "plus GST").
- Every figure that comes from model knowledge rather than a live source carries a [VERIFY] flag in the research; documents must keep those flags where they reuse the figure.

## 6. Pricing and revenue principles (constraints for the model designers)

1. **Fee-led, not commission-hidden.** Membership fees are the primary revenue line. Supplier commissions may be earned but under a **published fee-and-commission policy** (disclosed, and either retained under the policy or credited to the member). No hidden mark-ups on pass-through costs. This answers the objection raised to Indulge Global on Shark Tank and is designed to be compatible with the "pure agent" GST treatment for pass-through costs (Rule 33, CGST Rules) [research 09 once written; Indulge review].
2. **Avoid the crowded ₹2 to 5 lakh single-tier band as the core positioning.** The research recommends a two-tier architecture: a capped, dedicated-lifestyle-manager tier priced at ₹12 to 25 lakh per year for the US$30M+ household, and a tech-enabled tier at roughly ₹1.5 to 4 lakh distributed mainly through partners. The judge panel may refine tiers, joining fees and caps, but must justify any move into the ₹4 lakh WhatsApp-pod territory occupied by Indulge Global.
3. **B2B "private overlay" is a designed revenue engine, not an afterthought:** members' clubs first (weeks), ultra-luxury residences (2 to 6 months), wealth managers/multi-family offices (4 to 9 months), auto/watch/jewellery clienteling programmes; bank-card RFPs only as a Year 2 to 3 super-premium overlay. **No single B2B client above 30% of revenue** (DreamFolks lesson).
4. **Contracted peak-season inventory** (IPL suites, Diwali/New Year hotel allocations, Art Mumbai, Wimbledon debentures) is a budgeted line, not a claim.
5. **Staff to ratios, not headcount:** the model must respect lifestyle-manager-to-member ratios (about 1:8 elite, 1:25 named, up to 1:100+ tech-enabled) and a 7-person minimum for 24/7 coverage, with payroll at or below 50% of revenue by Year 3.
6. **Technology and AI budget of 5 to 8% of revenue** aimed at lifestyle-manager productivity (WhatsApp Business API, CRM, AI triage and drafting, supplier tooling), not an app for show.
7. **Trust and discretion as product:** DPDP Act compliance, NDAs, vetted staff, background checks, no-leak protocols, member data owned by the company (not by individual managers or a partner).

## 7. Funding guideline

- **Round: seed, target ₹10 to 16 crore (about US$1.15 to 1.85M)** to fund Year 0 plus 24 months of operations to a clear Series A milestone set (paying members, retention, B2B anchors, gross margin). The financial model determines the exact figure; if the modelled need exceeds ₹18 crore, structure it as pre-seed (₹3 to 5 Cr from angels and family offices) followed by seed.
- Instrument: CCPS (compulsorily convertible preference shares) for institutional/angel rounds; iSAFE or CCD acceptable for angels below ₹2 Cr. ESOP pool 10% created at seed.
- Benchmark: Indulge Global raised about US$1.28M in total, US$1M of it in January 2025 at roughly ₹56 Cr post-money, and is now raising US$2M [research 01, live-sourced].

## 8. Founding team assumption (to be replaced by the real founders' profiles)

- The plan assumes a founding team of two to three: a founder-CEO (brand, members, capital), a Head of Service and Operations from luxury hospitality or lifestyle management (ex-Taj/Oberoi/Four Seasons/Quintessentially/Aspire), and a Head of Partnerships and B2B (private banking, wealth management or luxury brand clienteling background), plus a fractional CTO/product lead until Year 2. Documents should describe roles, not invented names, and mark team slides "to be completed by the founders".
- This project is unrelated to any other business of the founder; do not reference other companies as the parent or as a customer base.

## 9. Documents that depend on these assumptions

| Assumption | Documents to update if it changes |
|---|---|
| Brand name | every document; brand kit; deck; outreach templates |
| Launch cities and sequencing | business model, financial model (hiring, offices), GTM playbook, 90-day plan, deck |
| Timeline and FY calendar | financial model, business plan sections 12 to 13, deck financial slides |
| Exchange rate | financial model input cell only; all USD brackets recalculate |
| Pricing principles and tiers | business model, revenue model, service catalogue, financial model, deck, FAQ |
| Funding target | financial model funding sheet, business plan section 15, deck ask slide, outreach playbook |
