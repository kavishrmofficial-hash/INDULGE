# Birla Fertility & IVF: social media pitch

Prepared 17 October 2026, in reply to Akanksha Rana's (Brand & Marketing Manager, Birla Fertility & IVF) LinkedIn call for a social media agency with healthcare or fertility experience.

**The proposal:** a 31-page HTML page in the Hanza look Mask360 built for The Park Hotels (four column guides, two-tone uppercase headings in Zalando Sans, Geist Mono labels, dark cloth chapter pages, the content as a mind map, a phone mock of the grid): `dist/birla-fertility-proposal.html` is the claude.ai artifact, `dist/index.html` the standalone page for a website or for printing to PDF. Three chapters: Your social today, No question too quiet, How it runs.

**The copy:** written the way the Hanza reference site sells. Each page leads with the outcome in one line ("We help Birla Fertility & IVF become the place India asks first"), a short heading with a full stop, then one promise line. Campaign pages run *The challenge* then *What we make*. The process is four named steps to the first post. The close asks "Ready to start?" and lists what she gets from the first meeting. All of it follows the Mask360 copy rules (no dashes, no contrast constructions, sentence case, no exclamation marks); `STRICT=1` in `deck/build.py` enforces them.

**Mask360 branding, kept quiet:** the m360 mark sits beside every page number, the running head carries an "m360 /Proposal" button, the dark chapter pages carry a faint m360 watermark, and the cover and close carry the mark in full. Birla Fertility & IVF stays the brand on every page.

**The live site:** `.github/workflows/deploy-birla.yml` builds the page with `web.py` (adds a no-index rule, the icon and the link-preview image from `web/`) and deploys it to EdgeOne Pages as `mask360birla`. Without the `EDGEONE_API_TOKEN` secret, a commit message with `[deploy]` or a run started by hand makes an anonymous deployment that must be claimed within an hour from the link in the run summary.

**The client's logo:** `deck/client-logo.png` (the full lockup, in every running head and on the cover and the close) and `deck/client-mark.png` (the three circles, as the profile picture in the post and grid mock-ups and as the site icon) are cut from the logo file supplied on 17 October 2026. Both keep the brand's own pink and navy; on navy pages the lockup's name turns white (`deck/client-logo-rev.png`). The whole page uses the brand colours: navy #1E2F7A as the ink and pink #DF94AB as the accent.

**The idea in one line:** *No question too quiet.* Birla Fertility & IVF becomes the place India asks first, with every answer given with "All Heart. All Science.", the brand's own line.

---

## 1. The brief, decoded

| What the post says | What it means | How the proposal answers |
|---|---|---|
| "Seeking a social media agency with proven healthcare/fertility experience" | She will screen on category work first. | Swisse Wellness UAE as live health work (page 28), and the content shown in full (12 to 20). |
| "understands the category's sensitivity" | Language, stigma, loss, both partners, and the law. | The house rule (9), the new NMC rules (8), the sensitivity code (25), community care (26). |
| "strategic, creative leadership and not just execution" | A point of view, beyond a content calendar. | The content as a mind map (12), the mix (13), the grid (14), the channels (6), the accounts (24) and a month on the feed (23). |
| "Relevant healthcare/fertility work" and "a few case studies or sample campaigns" | Samples are welcome, which lets a new-to-category agency compete. | Three sample campaigns with concept drawings and mock posts (16 to 19), and the people who speak (20). |
| "DM me or send your portfolio to akanksha.rana@birlafertility.com" | Two routes; email carries the link. | DM and email drafts below. |
| Posted by Brand & Marketing | Brand consistency and safety matter as much as reach. | Measures lead with trust, then consults (27). |

## 2. Research: what matters about Birla Fertility & IVF

**Company and brand**
- Part of CK Birla Healthcare, CK Birla Group. Avanti Birla is founder and chair. CEO Abhishek Aggrawal; CMO Parul Tyagi (June 2025).
- Line: "All Heart. All Science."
- 50+ centres, 120+ experts, 1,40,000+ IVF cycles (Instagram bio). 51 clinics in 38 cities across 18 states at the Jalandhar launch, mid-2025. Target of 100 clinics with Rs 500 crore+ invested.
- Acquired ARMC IVF, Kerala (86%, May 2024; co-branded, also in Doha and Dubai) and BabyScience (12 clinics, Aug 2024).
- Fertility Circle, a toll-free counselling line, 1800 123 1515, English and Hindi (June 2025). Its launch study: over 90% of people facing fertility problems feel emotionally exhausted; only 29% seek timely help.
- Their own success-rate page claims 63% after one cycle and 92% cumulative after three. **Do not raise this in writing.** It carries risk under ASCI rulings and the new NMC notice; raise it in the room, as part of the month-one audit.
- Past agencies: Lodestar UM (media, 2021), Creative Inc (creative, 2022). Current status unknown.

**Social**
- @birlafertility about 35K on Instagram, @birlafertility_armcivf about 11K, Facebook about 12K, LinkedIn about 7.6K (older snapshot), YouTube 470+ videos and about 10M views. **Check the live numbers before quoting.**

**Category**
- Indira IVF: 165+ centres, about 390K on Instagram, a 2025 feature film (Tumko Meri Kasam).
- Nova IVF: doctor-led myth-busting YouTube creator series. Cloudnine Fertility: "Every Fertility Journey is Different", World IVF Day 2026, male factor included. Ferty9: #TogetherInIVF street plays. Motherhood: patient gratitude stories.

**Rules**
- **NMC public notice, 6 October 2026** (from press reports): no promotional testimonials or patient success stories even with consent, no "best" or guaranteed outcomes, no AI-made patient images or voices, no agency or influencer pay tied to referrals. Factual health education stays allowed. **Read the notice's own text before sending.**
- ASCI upheld complaints against IVF success-rate and "best" claims (2019, 2020); health influencers must disclose qualifications (2023).
- ART Act 2021 s.32 and PCPNDT s.22 ban sex-selection advertising; Surrogacy Act 2021 s.38 bans commercial surrogacy ads; the Drugs and Magic Remedies Act schedule lists sterility in women.
- DPDP Rules notified November 2025. Meta bars ads that imply a viewer's health; family-planning ads reach adults only.

**Audience**
- WHO 2023: about 1 in 6 adults experience infertility. ISAR: male factors in 40 to 50% of cases in India. Stigma falls mostly on women, and families take part in decisions. About 200K to 250K IVF cycles a year, 400K expected by 2030, much of the growth in smaller cities.

## 3. The strategy, in short

1. **The problem:** people are exhausted and still don't ask (29% seek timely help), and the rules on patient stories just tightened.
2. **The insight:** the first fertility question gets typed at 1 a.m., alone.
3. **The platform:** *No question too quiet.* Doctor-led education at the centre, which the NMC notice still allows.
4. **The content, mapped:** four pillars (Answer, The Science, Reassure, Belong) and twelve series, shown as a mind map; five posts a week (Answer twice, the others once); eight channels with one job each; the Instagram grid on 26 December; December on the feed from 14 December. English and Hindi, plus each centre's city language.
5. **Three sample campaigns:** The 1 a.m. Questions (always on), Half the Story (men's fertility), The Good News Question (wedding season).
6. **Safety:** an eight-rule sensitivity code, the rule book, and community care with a crisis path (Tele-MANAS 14416) and Fertility Circle.
7. **Four steps to the first post:** listen (the audit), agree (the code), make (the shoot), launch (Question 01 on 14 December). Half the Story runs fortnightly from January; first readout in the week of 8 February 2027.
8. **Measurement:** saves and shares, questions asked, care response, search views, consult enquiries. The fee never depends on patient numbers.

## 4. To check before sending

- The NMC notice against its own text (pages 8 and 25 rely on it).
- Live follower counts if you quote them (pages 5 and 7).
- Page 28: any other health or wellness work to add next to Swisse.
- Page 29 promises six draft posts at the first meeting.

## 5. DM draft to Akanksha

> Hi Akanksha, saw your call for a social media agency for Birla Fertility & IVF.
>
> We put together a short point of view. Your own Fertility Circle study found over 90% of people facing fertility problems feel exhausted, and only 29% seek timely help. Our idea is *No question too quiet*: Birla Fertility & IVF becomes the place India asks first. It comes with three sample campaigns and a sensitivity code written for the NMC notice of 6 October.
>
> It's 31 pages: [link]. I'd love 20 minutes to walk you through it.
>
> Kaavish, Mask360

## 6. Email to akanksha.rana@birlafertility.com

**Subject:** No question too quiet: Mask360 for Birla Fertility & IVF

> Hi Akanksha,
>
> Your post asked for three things: healthcare and fertility work, a feel for the category's sensitivity, and strategic and creative leadership. Our proposal answers each one, and page 3 shows where: [link]
>
> In short: one platform, *No question too quiet*, built on your own finding that only 29% of people seek timely help. Three sample campaigns sit on it: The 1 a.m. Questions, Half the Story and The Good News Question. Everything is written for the NMC notice of 6 October, with doctor-led education at the centre.
>
> Our health work today is Swisse Wellness in the UAE, a 30-reel shoot. Fertility would be new for us, so we have shown our thinking in full.
>
> Could we have 20 minutes in the next two weeks? We'd bring six draft posts for your specialists to react to.
>
> Kaavish
> Mask360 · mask360.agency

## Sources

- [Birla Fertility & IVF acquires ARMC IVF (BioSpectrum India)](https://biospectrumindia.com/news/101/24602/birla-fertility-ivf-announces-acquisition-of-armc-ivf-fertility-chain.html)
- [ARMC 86% stake (Venture Intelligence)](https://news.ventureintelligence.com/ma/birla-fertility-acquires-86%25-stake-in-kerala-based-ivf-chain-armc)
- [BabyScience, 50 clinics (BioSpectrum India)](https://biospectrumindia.com/news/101/25052/birla-fertility-ivf-further-expands-network-to-50-clinics-by-acquiring-babyscience-ivf.html)
- [Jalandhar launch, 51 clinics (Medtech Spectrum)](https://medtechspectrum.com/news/2/24376/birla-fertility-ivf-expands-footprint-in-north-india.html)
- [Rs 500 crore plan (Business Standard)](https://www.business-standard.com/companies/news/ck-birla-group-firm-birla-fertility-ivf-to-invest-rs-500-cr-in-next-2-3-yrs-124082900681_1.html)
- [All Heart. All Science. (Digital Health News)](https://www.digitalhealthnews.com/birla-fertility-ivf-acquires-armc-ivf-fertility-chain)
- [Fertility Circle helpline and study (MediaBrief)](https://mediabrief.com/birla-fertility-and-ivf-launches-toll-free-fertility-circle/)
- [Success-rate page (Birla Fertility & IVF)](https://birlafertility.com/success-rate/)
- [IVF in Tier 2 and 3 cities (Business Standard, June 2025)](https://www.business-standard.com/industry/news/ivf-expansion-tier-2-tier-3-cities-fertility-rate-decline-india-125062200120_1.html)
- [@birlafertility on Instagram](https://www.instagram.com/birlafertility/)
- [Indira IVF IPO, 165+ centres (Business Standard)](https://www.business-standard.com/markets/news/indira-ivf-s-408-million-india-ipo-may-see-eqt-founders-exit-stake-125071501657_1.html)
- [Tumko Meri Kasam (ThePrint)](https://theprint.in/feature/vikram-bhatt-shares-his-experience-directing-anupam-kher-starrer-tumko-meri-kasam/2489034/)
- [Nova IVF creator series (Confluencr)](https://confluencr.com/nova-ivf/)
- [Cloudnine Fertility, World IVF Day 2026 (Business News This Week)](https://businessnewsthisweek.com/health/world-ivf-day-2026-cloudnine-fertility-launches-every-fertility-journey-is-different-and-begins-with-understanding-campaign/)
- [Ferty9 #TogetherInIVF (MediaNews4U)](https://www.medianews4u.com/ferty9s-togetherinivf-campaign-leverages-art-to-break-ivf-stigma/)
- [NMC advertising notice (The South First)](https://thesouthfirst.com/health/doctors-on-instagram-nmc-says-no-to-patient-testimonials-paid-ads-ai-promotions-and-guaranteed-claims/)
- [NMC advertising notice (BestMediaInfo)](https://bestmediainfo.com/mediainfo/advertising/nmc-issues-advertising-guidelines-for-doctors-and-hospitals-ai-promotions-fake-reviews-and-patient-inducements-barred-12637235)
- [ASCI CCC, October 2019](https://www.ascionline.in/wp-content/uploads/2022/09/october-2019-ccc-release.pdf) and [January 2020](https://www.ascionline.in/wp-content/uploads/2022/09/asci_jan_2020-_ccc_press_release.pdf)
- [ASCI health and finance influencer guidelines, 2023](https://www.ascionline.in/wp-content/uploads/2023/08/Health-and-Finance-Guidelines-Update-Press-Release.pdf)
- [ART (Regulation) Act 2021 (India Code)](https://www.indiacode.nic.in/bitstream/123456789/17031/1/aA2021-42.pdf)
- [Drugs and Magic Remedies Act 1954 (India Code)](https://www.indiacode.nic.in/bitstream/123456789/1412/1/195421.pdf)
- [DPDP Rules notified (Deccan Herald)](https://www.deccanherald.com/india/centre-notifies-dpdp-rules-implementation-planned-in-phases-spread-over-12-18-months-3798465)
- [Meta: personal attributes](https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/)
- [WHO infertility estimate (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10153621/)
- [Male infertility in India, ISAR (BioSpectrum India)](https://biospectrumindia.com/news/16/26445/6th-ivf-summit-sparks-significant-dialogue-on-growing-burden-of-male-infertility-in-india.html)
- [Families and infertility in India (ISCHP)](https://ischp.net/2024/08/28/when-we-is-more-than-two-families-and-infertility-in-india/)
