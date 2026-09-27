/* module: hunt. The big brand lane: one pursuit per person at a brand worth a retainer, with the trigger
   that opened the door, the twenty minute audit of their public handle, one carve out offer, and every
   piece of copy ready to paste: the three line proposition, the LinkedIn connect note and message, the
   email, the WhatsApp, the call opener, four follow ups and the answers to the objections that always come.
   People are found on Apollo through the EdgeOne function (edgeone/server/hunt.js) or typed in by hand.
   The playbook underneath is how networks win these accounts, turned into a weekly routine. */
'use strict';
(function () {
  const {html, React, U, UI, icons} = M;
  const {useState, useEffect, useMemo, useRef} = React;

  const SPARK = '✦';
  const live = () => !!window.M360_STANDALONE && typeof window.M360_API === 'function';
  const api = (a, body) => live() ? window.M360_API(a, body) : Promise.reject({code: 'unavailable', message: 'no server here'});

  /* ---------- the vocabulary ---------- */
  const TRIGGERS = [
    {v: 'newhead', label: 'New marketing head', when: 'write between day 30 and day 180 of their tenure; new leaders review agencies in their first two quarters'},
    {v: 'mandate', label: 'A mandate moved', when: 'write within 30 days of the news; the other lines are being looked at too'},
    {v: 'launch', label: 'A launch is coming', when: 'write 60 to 90 days before it, while the launch budget is unallocated'},
    {v: 'hiring', label: 'Hiring for social or content', when: 'write within 14 days of the job post; the role exists because the setup is failing or growing'},
    {v: 'festive', label: 'Festive or IPL season', when: 'July to September for Diwali work, December to February for IPL work'},
    {v: 'dip', label: 'Their content dipped', when: 'write within 7 days; the marketing head is already being asked about it'},
    {v: 'planning', label: 'Fiscal planning window', when: 'January to March, and the month before a mandate anniversary'},
    {v: 'network', label: 'Their network is restructuring', when: 'write within 60 days of the news or of the account team leaving'},
    {v: 'other', label: 'Something else', when: ''}
  ];
  const LANES = [
    {v: 'reels', label: 'Short video at volume', job: 'always on short video', outputs: 40, weeks: 8, metric: 'saves per reel', ask: 'Which sub brand or handle should we start on?'},
    {v: 'vernacular', label: 'Regional language content', job: 'a two language content lane with regional creators', outputs: 40, weeks: 8, metric: 'saves per reel', ask: 'Which language first?'},
    {v: 'creators', label: 'Creator program', job: 'a creator led series with 20 creators under 50k followers, paid per delivered video', outputs: 20, weeks: 8, metric: 'comments and shares per video', ask: 'Do you want the two videos before or after Diwali?'},
    {v: 'community', label: 'Community management', job: 'community replies and comment led content on one handle', outputs: 40, weeks: 8, metric: 'reply time and sentiment', ask: 'Which handle first?'},
    {v: 'cxo', label: 'CXO and LinkedIn content', job: 'the leadership and employer brand LinkedIn line', outputs: 24, weeks: 8, metric: 'reach per post', ask: 'Which leader should we start with?'},
    {v: 'launch', label: 'Launch content', job: 'launch content for the new range', outputs: 30, weeks: 6, metric: 'reach per post', ask: 'Before the launch date, or the month after?'},
    {v: 'festive', label: 'Festive overflow', job: 'the festive overflow line', outputs: 30, weeks: 6, metric: 'reach per post', ask: 'The four weeks before Dhanteras, or the four after?'},
    {v: 'property', label: 'Property led hotel content', job: 'property led reels shot with your GMs and chefs plus creator stays', outputs: 24, weeks: 12, metric: 'clicks on the direct booking link', ask: 'Which property should we shoot first?'},
    {v: 'overflow', label: 'In house overflow', job: 'overflow for your in house team, briefs in on Monday and edits back on Thursday', outputs: 40, weeks: 8, metric: 'pieces shipped a week', ask: 'Would 20 extra edits a week be useful or noise?'}
  ];
  const LANE_OF = {}; LANES.forEach(l => { LANE_OF[l.v] = l; });
  const TRIGGER_OF = {}; TRIGGERS.forEach(t => { TRIGGER_OF[t.v] = t; });
  const STAGES = [
    {v: 'found', label: 'Found'}, {v: 'audited', label: 'Audited'}, {v: 'sent', label: 'Sent'}, {v: 'replied', label: 'Replied'},
    {v: 'talking', label: 'Talking'}, {v: 'pilot', label: 'Pilot'}, {v: 'won', label: 'Retainer'}, {v: 'closed', label: 'Closed'}
  ];
  const STAGE_OF = {}; STAGES.forEach(s => { STAGE_OF[s.v] = s; });
  const OPEN = ['found', 'audited', 'sent', 'replied', 'talking', 'pilot'];
  const PLATFORMS = ['Instagram', 'LinkedIn', 'YouTube', 'X'];
  const TITLES = ['Head of Digital', 'Digital Marketing Lead', 'Brand Manager', 'Senior Brand Manager', 'Head of Social Media', 'Social Media Lead',
    'Head of Marketing', 'Marketing Head', 'Chief Marketing Officer', 'VP Marketing', 'Head of Influencer Marketing', 'Head of Content',
    'Corporate Communications', 'Head of Brand', 'Head of Growth', 'Head of E commerce'];
  const TITLE_SETS = [
    {v: 'social', label: 'Social and digital owners', titles: ['Head of Digital', 'Digital Marketing', 'Head of Social Media', 'Social Media Lead', 'Social Media Manager', 'Head of Content', 'Creator Marketing', 'Influencer Marketing']},
    {v: 'brand', label: 'Brand managers', titles: ['Brand Manager', 'Senior Brand Manager', 'Brand Lead', 'Category Marketing', 'General Manager Marketing']},
    {v: 'head', label: 'Marketing heads', titles: ['Chief Marketing Officer', 'Head of Marketing', 'Marketing Head', 'VP Marketing', 'Vice President Marketing', 'Director Marketing']},
    {v: 'corp', label: 'Corporate and growth', titles: ['Corporate Communications', 'Employer Brand', 'Head of Growth', 'Head of E commerce', 'D2C']}
  ];
  /* the follow up ladder after a first touch: day 3, day 7, day 14, day 30, then closed for ninety days */
  const LADDER = [3, 4, 7, 16];
  const CHANNELS = [{v: 'linkedin', label: 'LinkedIn'}, {v: 'email', label: 'Email'}, {v: 'whatsapp', label: 'WhatsApp'}, {v: 'call', label: 'Call'}, {v: 'meeting', label: 'Meeting'}];

  const OBJECTIONS = [
    {q: 'We already have an agency.', a: 'Keep them. I am not asking for their work. I am asking for the one job in my note, for {weeks} weeks, alongside them, judged on a number you already track. The first two pieces are made, so you judge work and not a promise. If the number does not move, nothing changes for you and you have a benchmark for your next agency review. You do not have to fire anyone to hire us.'},
    {q: 'Our agency handles social as part of an integrated mandate.', a: 'Integrated mandates are strong on the campaign and thin on the daily feed, because a network earns on films and media and not on 40 reels a month. We will not touch the campaign. We take the always on volume, the regional handle or the creator series, inside your agency\'s guidelines and calendar. Ask who exactly on their team is making your short video next month.'},
    {q: 'Two agencies create friction.', a: 'Most brands your size already run four or five: media, creative, PR, influencer, performance. We work as a specialist supplier to your team, we share a weekly calendar with your lead agency and we never pitch their scope. Most AORs prefer this to being asked for 60 reels a month at network overhead.'},
    {q: 'You are too small for a brand our size.', a: 'Small is the product. The founder is in your WhatsApp group, work turns around in 48 hours, and you pay per piece. Several Tata social lines sit with studios our size. Size is a risk for a master mandate, which is not what I am proposing.'},
    {q: 'Send me your credentials deck.', a: 'I will send one page: what I saw on your handle, what I would do in {weeks} weeks, the price per piece, and the two pieces we made for {brand} this week. If those are not better than your last month, a deck will not help either.'},
    {q: 'We are locked into a contract until March.', a: 'Then nothing has to change until March. A project on one sub brand sits outside the retainer at most companies; if your contract carries digital exclusivity, tell me and I will make the two spec pieces anyway. Either way you walk into the renewal with a benchmark.'},
    {q: 'Procurement takes months, we only use empanelled agencies.', a: 'Start under the PO threshold as a project with the same paperwork you use for a photographer or a creator; tell me the threshold and I will size the pilot to it. Our vendor folder is ready, so empanelment runs in parallel and the second project is clean. I will talk to your procurement contact myself.'},
    {q: 'There is no budget this year.', a: 'The budget is sitting in a retainer line for work that is not being delivered at volume, and a pilot under your PO limit costs less than one unused campaign line. If the number is still a problem, the two spec pieces are already made, and we can size the first project to the next launch or festive budget.'},
    {q: 'We do this in house now.', a: 'Then you have a throughput problem, and the bottleneck is shoot and edit volume. We are the overflow: briefs in on Monday, {perweek} edits back by Thursday, your team keeps the brand voice and the approvals, nobody on your side looks replaceable, at a per piece rate you can compare with one more hire.'},
    {q: 'Our agencies are decided globally, or by the group.', a: 'The master mandate, yes. Local language content, creator volume, regional launches and sub brand handles sit with the India brand team, and that is the only thing I am asking about. If your social is genuinely locked abroad, tell me and I will stop.'},
    {q: 'Have you worked in our category?', a: 'Our work is in luxury, hospitality and wellness, and it is in the link. What you are buying is native short video at volume, which is category agnostic; the category knowledge sits with your brand manager and we come to your office for it. One lane, {weeks} weeks, your guidelines, your approval on every piece.'},
    {q: 'Not now, come back after festive.', a: 'Understood. Two things before I go: the gap in my note will still be there after festive, and if the last four weeks before Dhanteras need a second pair of hands, we can start on Monday with zero onboarding. I will write again in the first week of January for the April planning cycle.'},
    {q: 'Talk to my brand manager or my social lead.', a: 'Happy to. May I say you asked me to write to them? One line from you doubles the chance they read it, and I will send you the same one page so nothing reaches them that you have not seen.'},
    {q: 'Our agency can do that too, I will just ask them.', a: 'Please do, that is a good outcome for you either way. If they fix it in the next 30 days you have lost nothing. If they do not, you have a second option ready and the two pieces are still yours.'},
    {q: 'What is the catch in the free pieces?', a: 'Two things, both in writing. At day 45 of a pilot we have a conversation about extending, and if the pilot beats the benchmark we ask for a reference we can name. Spec means two pieces with a scope and a deadline, and you keep them either way.'},
    {q: 'We tried a small agency before and it did not work.', a: 'What broke, the work or the follow through? Each of those is a contract term for us: a named senior on the account, a 48 hour turnaround in the SOW, a weekly one page number, and a 30 day exit with no penalty. Give us a project you would not miss if it failed.'},
    {q: 'Send me a proposal.', a: 'Within 24 hours, one page: the job, the number, the price per piece, the exit. Nothing you would need to explain to anyone.'},
    {q: 'What do you charge?', a: 'Per delivered piece, and you see the rate card before we start: {price} for the pilot at this volume, creator fees included. There is no retainer until the pilot earns one.'}
  ];

  /* the playbook, condensed from how Dentsu, Ogilvy and Havas win and keep these accounts in India */
  const HOW = [
    'Big Indian accounts are allocated before the review exists. The marketing head and the group brand custodian assemble the longlist from agencies they already know; the review confirms a choice half made. Get known to each marketing head every quarter, through audits, notes and events.',
    'Tata is not one account. It is Titan, Tanishq, Westside, Croma, Tata Neu, BigBasket, Tata 1mg, Tata Consumer, IHCL, Tata AIG, Tata Play, Voltas, Air India and more, each with its own marketing head, roster and calendar. The roster splits into creative AOR, media, social, influencer, performance and content, and social is the line an independent enters through.',
    'Networks staff always on social with two juniors inside a creative AOR that earns on films. Short video velocity, regional language, creators, community management and CXO LinkedIn content are under loved at almost every big brand. That seam is the product.',
    'A marketing head can sign a project of 5 to 25 lakh without an RFP. A retainer triggers procurement, empanelment and a pitch. The first invoice is a 60 day scoped project under that limit, next to the incumbent, never in their place on day one.',
    'Procurement scores risk before work. Keep GST, MSME, a data policy, three years of financials, two references and a resource rate card in one folder so a champion can push you through vendor registration in a week.',
    'Reviews shortlist on one verifiable number. The networks bring Effies and Cannes; the independent brings one before and after per format, and that is enough on a social line.',
    'Marketing heads call their ex Unilever, ex Ogilvy and ex Dentsu colleagues when a line opens. Map where each target worked before, find the shared person, and ask every client for one introduction a quarter.',
    'Networks send unsolicited IPL, Diwali and launch ideas, and brands accept them because they cost nothing. Three Reels concepts made for the brand and sent for free are the cheapest credible proof of thinking.',
    'Follow churn. A network merger, a conflict between two brands under one roof, an account team leaving: every one reopens a line, and the window is about 30 days.',
    'Indian owned groups decide brand by brand in Mumbai and Bengaluru. MNC subsidiaries have their social locked by global alignments decided abroad; leave them.'
  ];
  const WEEK = [
    {d: 'Monday, 60 min', t: 'Build the week from Radar: people moves, mandates and launches in the last seven days at the target groups. Pick 5 brands with a live trigger and add one person two levels below the CMO for each.'},
    {d: 'Tuesday, 2 hours', t: 'Run the 20 minute audit on each of the 5: posts in 30 days, Reels of those, Reels reach as a percent of followers, days since a reply to a comment, days since a creator post, languages, and the same for one competitor. Fill the numbers here and press Write.'},
    {d: 'Wednesday and Thursday, 90 min a day', t: 'Send 15 LinkedIn connects, 10 emails from your own mailbox, 5 calls to Apollo numbers between 10 and 1, and WhatsApp only people who replied or were referred. Press Sent on every piece so the follow ups land on the right day.'},
    {d: 'Thursday, 60 min', t: 'Work the Due today list: day 3, 7, 14 and 30 follow ups, each carrying a new number, a new piece or a new person. Never a checking in.'},
    {d: 'Friday, 2 hours', t: 'Make the three spec pieces for the warmest brand and send them with the day 7 note. Publish one teardown of a category with numbers, never about Mask360. One award entry a quarter with the best pilot.'}
  ];
  const DONT = [
    'No brand from the target list goes into the seven mailbox Apollo sequence; that machine stays on mid sized D2C, luxury and hospitality. The big brand lane is hand written from your own mailbox, LinkedIn and phone, ten accounts a week.',
    'No deck, no credentials PDF and no case study list on first touch; one observation with a number and something already made.',
    'No meeting request in the first message; the only ask is permission to send the work, or one closed question.',
    'No group level pitch to Tata, Reliance, Birla or Mahindra, and never the master social mandate; one lane at the subsidiary or sub brand where a single marketing head can say yes.',
    'Never name the incumbent in writing, criticise them or hint at them; the gap is on the handle, never on the agency.',
    'No guessed numbers, names, titles, dates or quotes; one wrong number or one wrong title in a first message ends the account.',
    'No free month and no contingent fee; a Tata company cannot raise a PO on a conditional payment. Spec is two pieces with a scope and a deadline.',
    'No retainer quote before the pilot; price per delivered piece, rate card shown before the start, and let the retainer come from their side.',
    'Never call Mask360 a 360 degree, full service or integrated agency; the reader already has one of those and the word makes you interchangeable.',
    'No WhatsApp or call to an Apollo number before the person has accepted a connect, replied or opened twice; the first WhatsApp says how you got the number and offers to stop.',
    'No messages on Sundays, holidays, before 9 or after 8; write Tuesday to Thursday, 9 to 11 or 4 to 6, and call between 10 and 1.',
    'No more than five touches in 30 days per person, one ask per message, and never three people at the same brand in the same week.',
    'No checking in or bumping this; every follow up carries a new number, a new piece or a new person.',
    'No note to a brand whose agency was appointed in the last nine months, except the sub brands the winner will neglect.',
    'No exclamation marks, no emoji, no dashes, no fake familiarity, and no line that could be pasted to another brand unchanged.'
  ];
  const TARGET_GROUPS = ['Tata', 'Reliance Retail', 'Aditya Birla', 'Godrej', 'Mahindra', 'ITC', 'Bajaj', 'Marico', 'Dabur', 'Emami', 'Titan', 'Trent', 'IHCL', 'Oberoi', 'Nykaa', 'Asian Paints', 'Pidilite', 'Britannia', 'Amul', 'Hero'];

  /* ---------- helpers ---------- */
  const huntOf = ctx => (ctx && ctx.settings && ctx.settings.hunt) || {};
  const firstOf = who => String(who || '').trim().split(/\s+/)[0] || 'there';
  const num = x => { const n = Number(x); return isFinite(n) && String(x).trim() !== '' ? n : null; };
  const has = x => num(x) !== null;
  const need = label => '[' + label + ']';
  const pursuits = ctx => Object.keys(ctx.coll.hunt.map).map(id => ({id, ...ctx.coll.hunt.map[id]})).filter(p => p && p.brand !== undefined);
  const stageOf = p => STAGE_OF[p.stage] || STAGE_OF.found;
  const isOpen = p => OPEN.includes(stageOf(p).v);
  const laneOf = p => LANE_OF[p.lane] || LANES[0];
  const clip = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') : t; };

  /* the settings the copy leans on, with what is missing named so the founder fills it in Admin */
  function bankOf(ctx) {
    const h = huntOf(ctx);
    const proofs = (Array.isArray(h.proofs) ? h.proofs : []).filter(p => p && p.client && p.after);
    return {
      proofs, proof: proofs[0] || null,
      team: has(h.teamSize) ? String(num(h.teamSize)) : need('team size'),
      phone: h.phone || need('your number'),
      link: h.link || need('link to the three pieces'),
      price: h.price || 'under 8 lakh, one PO',
      signoff: h.signoff || 'Kaavish, Mask360, Mumbai',
      perweek: has(h.perWeek) ? String(num(h.perWeek)) : '20'
    };
  }

  /* every piece of copy from the pursuit and the bank, by substitution. Numbers that were not audited
     appear in square brackets so nothing is ever guessed, and the incumbent is never named. Returns {copy, missing}. */
  function writeCopy(p, bank) {
    const a = p.audit || {};
    const lane = laneOf(p);
    const first = firstOf(p.who);
    const brand = p.brand || need('brand');
    const sub = p.sub || p.handle || brand;
    const platform = p.platform || 'Instagram';
    const competitor = a.competitor || need('competitor');
    const job = p.job || lane.job;
    const weeks = has(p.weeks) ? String(num(p.weeks)) : String(lane.weeks);
    const outputs = has(p.outputs) ? String(num(p.outputs)) : String(lane.outputs);
    const metric = p.metric || lane.metric;
    const ask = lane.ask;
    const missing = [];
    const n = has(a.posts) ? String(num(a.posts)) : (missing.push('posts in 30 days'), need('posts in 30 days'));
    const m = has(a.compPosts) ? String(num(a.compPosts)) : (missing.push('competitor posts in 30 days'), need('competitor posts'));
    const x = has(a.compMult) ? String(num(a.compMult)) : (missing.push('how many times more ' + metric + ' the competitor gets'), need('x'));
    if (!a.competitor) missing.push('the competitor');
    if (!p.who) missing.push('the person');
    if (!bank.proof) missing.push('a proof outcome in Admin, Hunt');
    const compFormat = a.compFormat || 'Reels';
    const reels = has(a.reels) ? ', ' + num(a.reels) + ' of them Reels' : '';
    const reach = has(a.reach) ? ', reaching about ' + num(a.reach) + ' percent of followers' : '';
    const replyLine = has(a.replyDays) ? ' The last comment that got a reply from the brand was ' + num(a.replyDays) + ' days ago.' : '';
    const creatorLine = has(a.creatorDays) ? ' The last creator led post was ' + num(a.creatorDays) + ' days ago.' : '';
    const quoteLine = a.quote ? ' Your own results call said ' + a.quote + '.' : '';
    const proof = bank.proof ? ' We took ' + bank.proof.client + (bank.proof.format ? ' ' + bank.proof.format : '') + ' from ' + (bank.proof.before || need('before')) + ' to ' + bank.proof.after + ' in ' + (bank.proof.days || 90) + ' days with the same ' + bank.team + ' person team.' : '';
    const l1 = brand + ' posted ' + n + ' times on ' + platform + ' in the last 30 days' + reels + reach + '; ' + competitor + ' posted ' + m + ' and its ' + compFormat + ' got ' + x + ' times the ' + metric + '.' + quoteLine;
    const l2 = 'We would take one job alongside your current agency: ' + job + ' for ' + sub + ', ' + weeks + ' weeks, ' + outputs + ' pieces, judged on ' + metric + ' against your own 30 day median.';
    const l3 = 'The first two are already made inside your guidelines: ' + bank.link + '. Fixed fee ' + bank.price + ', exit at day 30, you keep every file. ' + ask;
    const connect = clip('Hi ' + first + ', Kaavish here, I run a social studio in Mumbai. ' + brand + ' posted ' + n + ' times in the last 30 days; ' + competitor + ' posted ' + m + ' and got ' + x + ' times the ' + metric + '. I have one fix that does not touch your agency. Can I send it here, no deck, no call?', 300);
    const message = 'Thanks for connecting, ' + first + '. Three lines, as promised.\n\n' + l1 + replyLine + creatorLine + ' That is a volume and format gap, not a strategy problem.\n\n' + l2 + proof + '\n\n' + l3;
    const mailSubject = brand + ' on ' + platform + ', one number';
    const mailBody = first + ', ' + l1 + replyLine + creatorLine + ' Nobody needs to be fired for this.\n\n' + l2 + proof + '\n\n' + l3 + '\n\n' + bank.signoff;
    const whatsapp = 'Hi ' + first + ', Kaavish from Mask360 in Mumbai. ' + (p.mutual ? p.mutual + ' suggested I write to you, and ' : '') + 'I emailed you about ' + brand + ' on ' + platform + '. Not selling on WhatsApp, only sending the two pieces we made for ' + sub + ' so you can see them on your phone: ' + bank.link + '. If you would rather I did not use this number, say so and I will stay on email.';
    const call = first + ', Kaavish from Mask360 in Mumbai. I sent you a note about ' + brand + ' on ' + platform + '; this is ninety seconds, not a pitch. Is this a bad time?\n\nOne observation and one question. ' + brand + ' posted ' + n + ' times in the last 30 days, ' + competitor + ' posted ' + m + ' and got ' + x + ' times the ' + metric + '. I am not calling about your agency. If someone handed you ' + outputs + ' extra native pieces for ' + sub + ' over ' + weeks + ' weeks, priced per piece, with the first two already made, would that be useful or would it be noise?';
    const followups = [
      'Day 3: ' + first + ', the two pieces we made for ' + sub + ' are here: ' + bank.link + '. Twenty seconds each, made inside your guidelines, yours to use whether or not we ever talk. If the ' + metric + ' number in my note is wrong, tell me and I will redo it.',
      'Day 7: One more data point since my note: ' + competitor + ' posted ' + need('this week count') + ' times this week and ' + need('what changed') + '. That gap is the whole pilot. Is ' + sub + ' yours to decide, or should I be writing to ' + need('the other role') + '?',
      'Day 14: ' + first + ', no pitch today. We published a short teardown of ' + need('the category') + ' handles this week (' + need('teardown link') + ') and ' + brand + ' comes out ' + need('where it lands') + '. Thought you should see it before someone else forwards it to you.',
      'Day 30: Closing the loop, ' + first + ', this is my last note. ' + brand + ' ' + metric + ' this month: ' + need('n') + '; ' + competitor + ': ' + need('m') + '. If the ' + need('season or quarter') + ' plan opens a slot for a ' + weeks + ' week lane, the offer stands and the two pieces are still yours. Who should I talk to if not you?'
    ];
    const objections = OBJECTIONS.map(o => ({q: o.q, a: o.a.replace(/\{weeks\}/g, weeks).replace(/\{brand\}/g, brand).replace(/\{team\}/g, bank.team).replace(/\{perweek\}/g, bank.perweek).replace(/\{price\}/g, bank.price)}));
    return {copy: {proposition: [l1, l2, l3], connect, message, mailSubject, mailBody, whatsapp, call, followups, objections, by: 'template', at: Date.now()}, missing};
  }

  /* the same pieces written by the model from the same facts; the template stays as the floor */
  async function aiCopy(ctx, p, bank, o) {
    const base = writeCopy(p, bank);
    const a = p.audit || {};
    const lane = laneOf(p);
    const facts = [
      'PERSON: ' + (p.who || '[unknown]') + ', ' + (p.title || '[title unknown]') + ' at ' + (p.company || p.brand || '[company]'),
      'BRAND: ' + (p.brand || '[brand]') + (p.sub ? ', sub brand or handle ' + p.sub : '') + ', platform ' + (p.platform || 'Instagram'),
      'TRIGGER: ' + ((TRIGGER_OF[p.trigger] || {}).label || 'none') + (p.triggerNote ? ', ' + p.triggerNote : ''),
      'AUDIT, last 30 days: posts ' + (has(a.posts) ? a.posts : '[not audited]') + '; reels ' + (has(a.reels) ? a.reels : '[unknown]') + '; reels reach as percent of followers ' + (has(a.reach) ? a.reach : '[unknown]') +
        '; days since a reply to a comment ' + (has(a.replyDays) ? a.replyDays : '[unknown]') + '; days since a creator post ' + (has(a.creatorDays) ? a.creatorDays : '[unknown]') + '; languages ' + (a.languages || '[unknown]'),
      'COMPETITOR: ' + (a.competitor || '[unknown]') + ', posts ' + (has(a.compPosts) ? a.compPosts : '[unknown]') + ', its ' + (a.compFormat || 'Reels') + ' get ' + (has(a.compMult) ? a.compMult : '[unknown]') + ' times the ' + (p.metric || lane.metric),
      'INCUMBENT AGENCY, FOR YOUR EYES ONLY, NEVER WRITTEN: ' + (a.incumbent || 'unknown'),
      'PUBLIC QUOTE FROM THEIR CEO OR CFO: ' + (a.quote || 'none'),
      'THE OFFER: ' + (p.job || lane.job) + ' for ' + (p.sub || p.brand || '[brand]') + ', ' + (has(p.weeks) ? p.weeks : lane.weeks) + ' weeks, ' + (has(p.outputs) ? p.outputs : lane.outputs) + ' pieces, judged on ' + (p.metric || lane.metric) + ', fixed fee ' + bank.price + ', alongside their current agency, the first two pieces already made at ' + bank.link + '. CLOSED QUESTION TO END LINE 3: ' + lane.ask,
      'PROOF: ' + (bank.proof ? bank.proof.client + ' ' + (bank.proof.format || '') + ' from ' + (bank.proof.before || '?') + ' to ' + bank.proof.after + ' in ' + (bank.proof.days || 90) + ' days' : 'none yet'),
      'TEAM SIZE: ' + bank.team + '. SIGN OFF: ' + bank.signoff + '. PHONE: ' + bank.phone + (p.mutual ? '. MUTUAL: ' + p.mutual : '')
    ].join('\n');
    const prompt = 'You write outbound for Kaavish Ramchandani, founder of Mask360, a Mumbai social first content studio, to a marketing person at a large Indian brand that already has an agency. Large Indian groups buy agencies at the operating company or sub brand level and award the social, creator and content lines separately; every target already has an agency and we never ask them to leave it, never name it, never criticise it or hint at it. We ask for one job that agency is not built for at retainer economics, alongside it. The buyer ignores decks, 360 degree claims and call asks; they forward a message that is about their brand, carries a number they did not have, names a competitor, comes with something already made, costs nothing to test and fires no one. ' +
      'The proposition is three sentences, under 80 words in total: line 1 an observation counted on their own handle in the last 30 days with a number and a named competitor, tied to their CEO or CFO quote when one is given; line 2 the carve out, one job, one sub brand or platform or language, a time box in weeks, one number they already track, alongside their current agency; line 3 the safe yes, the first two pieces already made inside their guidelines, a fixed fee under the PO limit, one PO, exit at day 30, they keep every file, ending in the closed question given. ' +
      'Rules for every piece: no adjectives about Mask360, never the words 360 degree, full service or integrated, never a free month or a contingent fee, one ask per message, at most five sentences per channel, no meeting request in the first message, no exclamation marks, no emoji, no dashes, no fake familiarity. ' +
      'Use only the facts below. Where a number is missing write it in square brackets like [posts in 30 days], never invent one, and never invent a name, a title, a date or a quote. The connect note is under 300 characters. The follow ups are day 3, 7, 14 and 30 and each carries a new number, a new piece or a new person, never a checking in; the day 30 note is the last one and asks who else to talk to.\n\n' + facts +
      '\n\nAnswer with JSON only, exactly these keys: {"proposition": ["line 1", "line 2", "line 3"], "connect": "", "message": "", "emailSubject": "", "email": "", "whatsapp": "", "call": "", "followups": ["day 3", "day 7", "day 14", "day 30"]}';
    const j = await M.ai.json(ctx, prompt, {signal: o && o.signal, cache: false});
    const out = {...base.copy, by: 'ai', at: Date.now()};
    const str = v => (typeof v === 'string' && v.trim()) ? v.trim() : null;
    if (Array.isArray(j.proposition) && j.proposition.length === 3 && j.proposition.every(str)) out.proposition = j.proposition.map(s => s.trim());
    ['connect', 'message', 'whatsapp', 'call'].forEach(k => { if (str(j[k])) out[k] = j[k].trim(); });
    if (str(j['emailSubject'])) out.mailSubject = j['emailSubject'].trim();
    if (str(j['email'])) out.mailBody = j['email'].trim();
    if (Array.isArray(j.followups) && j.followups.length === 4 && j.followups.every(str)) out.followups = j.followups.map(s => s.trim());
    out.connect = clip(out.connect, 300);
    return {copy: out, missing: base.missing};
  }

  /* a brand, a person and a trigger out of a Radar headline: "X joins Y as CMO", "Y appoints X as head of marketing",
     "Agency wins the Y creative mandate", "Y launches Z" */
  function seedFromNews(it) {
    const t = String(it.title || '').replace(/\s+/g, ' ').trim();
    let m;
    const seed = {trigger: 'other', triggerNote: t, link: it.link || ''};
    if ((m = /^(.+?) joins (.+?) as (?:the |its )?(.+?)(?:[.,;]|$)/i.exec(t))) return {...seed, who: m[1], brand: m[2], company: m[2], title: m[3], trigger: 'newhead'};
    if ((m = /^(.+?) (?:appoints|names|elevates|promotes) (.+?) (?:as|to) (?:the |its )?(.+?)(?:[.,;]|$)/i.exec(t))) return {...seed, brand: m[1], company: m[1], who: m[2], title: m[3], trigger: 'newhead'};
    if ((m = /^(.+?) (?:wins|bags|retains|picks up) (?:the )?(.+?)(?:'s)? (?:creative|media|digital|social media|social|influencer|integrated|pr)? ?(?:account|mandate|business|duties)/i.exec(t))) return {...seed, brand: m[2], company: m[2], trigger: 'mandate', audit: {incumbent: m[1]}};
    if ((m = /^(.+?) (?:appoints|selects|picks|onboards|ropes in) (.+?) (?:as|for) (?:its |the )?(?:creative|media|digital|social media|social|influencer)/i.exec(t))) return {...seed, brand: m[1], company: m[1], trigger: 'mandate', audit: {incumbent: m[2]}};
    if ((m = /^(.+?) (?:launches|unveils|introduces|debuts|rolls out|enters|forays into) (.+?)(?:[.,;]|$)/i.exec(t))) return {...seed, brand: m[1], company: m[1], sub: clip(m[2], 60), trigger: 'launch'};
    if (it.lane === 'people') return {...seed, trigger: 'newhead'};
    if (it.lane === 'accounts') return {...seed, trigger: 'mandate'};
    if (it.lane === 'launches') return {...seed, trigger: 'launch'};
    return seed;
  }

  /* ---------- writes ---------- */
  function blank(ctx, seed) {
    const s = seed || {};
    return {
      brand: s.brand || '', group: s.group || '', sub: s.sub || '', handle: s.handle || '', platform: s.platform || 'Instagram', domain: s.domain || '',
      trigger: s.trigger || 'other', triggerNote: s.triggerNote || '', link: s.link || '',
      who: s.who || '', title: s.title || '', company: s.company || s.brand || '', linkedin: s.linkedin || '', mail: s.mail || '', phone: s.phone || '', apolloId: s.apolloId || '', mutual: '',
      audit: {posts: '', reels: '', reach: '', replyDays: '', creatorDays: '', languages: '', competitor: '', compPosts: '', compFormat: 'Reels', compMult: '', incumbent: '', quote: '', ...(s.audit || {})},
      lane: s.lane || 'reels', job: '', weeks: '', outputs: '', metric: '', copy: null, touches: [], step: 0, next: '',
      stage: 'found', owner: ctx.uid, created: Date.now(), updated: Date.now()
    };
  }
  async function create(ctx, seed) {
    const id = U.uid();
    await ctx.W.set('hunt/' + id, blank(ctx, seed));
    return id;
  }
  const save = (ctx, id, patch) => ctx.W.merge('hunt/' + id, {...patch, updated: Date.now()});
  async function markSent(ctx, p, channel, label) {
    const step = Number(p.step) || 0;
    const days = LADDER[step];
    const touches = (Array.isArray(p.touches) ? p.touches : []).concat([{at: Date.now(), channel, note: label || ''}]).slice(-40);
    const patch = {touches, step: step + 1};
    if (days) patch.next = U.ymd(U.addDays(new Date(), days));
    else { patch.next = ''; patch.stage = 'closed'; patch.closedUntil = U.ymd(U.addDays(new Date(), 90)); }
    if (days && (p.stage === 'found' || p.stage === 'audited')) patch.stage = 'sent';
    await save(ctx, p.id, patch);
    M.sound.play('tick');
    M.toast(days ? 'Logged. Next touch on ' + U.fmtDay(patch.next) : 'Logged. Closed for ninety days after five touches');
  }

  /* ---------- small parts ---------- */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); M.toast('Copied'); return true; }
    catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        M.toast('Copied'); return true;
      } catch (e2) { M.toast('Select the text and copy it by hand', true); return false; }
    }
  }
  function CopyBlock({label, text, channel, p, id, hint}) {
    const ctx = M.useCtx();
    const chars = String(text || '').length;
    return html`<div class="hunt-block" id=${id}>
      <div class="row between" style=${{marginBottom: '6px'}}>
        <span class="row nowrap" style=${{gap: '8px'}}><${UI.Micro} plain>${label}<//>${hint ? html`<span class="tiny ink62">${hint}</span>` : null}<span class="tiny sub num">${chars} chars</span></span>
        <span class="row nowrap" style=${{gap: '6px'}}>
          <${UI.Btn} kind="sec" sm=${true} onClick=${() => copyText(text)}>Copy<//>
          ${channel && p ? html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => markSent(ctx, p, channel, label)}>Sent<//>` : null}
        </span>
      </div>
      <div class="hunt-copy">${text}</div>
    </div>`;
  }

  /* ---------- Apollo: find the person ---------- */
  function usePeople() {
    const [state, setState] = useState({rows: [], busy: false, err: '', total: 0, companies: []});
    const findCompanies = async q => {
      setState(s => ({...s, busy: true, err: ''}));
      try { const r = await api('huntcompanies', {q}); setState(s => ({...s, busy: false, companies: r.rows || []})); }
      catch (e) { setState(s => ({...s, busy: false, err: (e && e.message) || 'That did not work.'})); }
    };
    const findPeople = async (domain, titles, q) => {
      setState(s => ({...s, busy: true, err: '', rows: []}));
      try { const r = await api('huntpeople', {domain, titles, q}); setState(s => ({...s, busy: false, rows: r.rows || [], total: r.total || 0})); }
      catch (e) { setState(s => ({...s, busy: false, err: (e && e.message) || 'That did not work.', rows: []})); }
    };
    return {...state, findCompanies, findPeople};
  }

  function Finder({onPursue, seed}) {
    const ctx = M.useCtx();
    const [brand, setBrand] = useState((seed && seed.brand) || '');
    const [domain, setDomain] = useState((seed && seed.domain) || '');
    const [set, setSet] = useState('social');
    const [st, setSt] = useState(null);
    const ppl = usePeople();
    const isLive = live();
    useEffect(() => { if (isLive) api('apollostatus').then(setSt).catch(() => setSt({configured: false})); }, [isLive]);
    useEffect(() => { if (seed && seed.brand) setBrand(seed.brand); if (seed && seed.domain) setDomain(seed.domain); }, [seed && seed.brand, seed && seed.domain]);
    const titles = (TITLE_SETS.find(x => x.v === set) || TITLE_SETS[0]).titles;
    const go = () => { if (domain.trim() || brand.trim()) ppl.findPeople(domain.trim(), titles, brand.trim()); };
    const configured = !!(st && st.configured);
    return html`<${UI.Card} title="Find the person" id="hunt-finder" action=${isLive ? html`<${UI.Pill} kind=${configured ? 'ink' : 'outline'}>${configured ? 'Apollo on' : 'Apollo off'}<//>` : null}>
      <div class="grid3" style=${{alignItems: 'end'}}>
        <${UI.Input} id="hunt-brand" label="brand or company" value=${brand} onChange=${setBrand} placeholder="Tata Consumer, Westside, Taj" onEnter=${go}/>
        <${UI.Input} id="hunt-domain" label="their domain" value=${domain} onChange=${setDomain} placeholder="tataconsumer.com" onEnter=${go} hint=${isLive && configured ? 'The people search runs on the domain. Type the name to look it up.' : ''}/>
        <${UI.Select} id="hunt-titles" label="who" value=${set} onChange=${setSet} options=${TITLE_SETS.map(x => ({v: x.v, label: x.label}))}/>
      </div>
      <div class="row" style=${{marginTop: '10px', gap: '8px'}}>
        ${isLive && configured ? html`<${UI.Btn} id="hunt-find" disabled=${ppl.busy || !(domain.trim() || brand.trim())} onClick=${go}>${ppl.busy ? 'Looking' : 'Find people on Apollo'}<//>
          ${!domain.trim() && brand.trim() ? html`<${UI.Btn} kind="sec" disabled=${ppl.busy} onClick=${() => ppl.findCompanies(brand.trim())} id="hunt-find-co">Look up the domain<//>` : null}
          <span class="tiny ink62">Searching people is free on Apollo; a domain lookup spends one credit, an email one, a number about eight.</span>` : null}
        <${UI.Btn} kind=${isLive && configured ? 'ghost' : 'sec'} id="hunt-manual" onClick=${() => onPursue({brand: brand.trim(), domain: domain.trim(), company: brand.trim()})}>Add a person by hand<//>
      </div>
      ${isLive && !configured && st ? html`<div class="small ink62" style=${{marginTop: '8px'}}>Apollo is not wired yet. The founder pastes the Apollo API key in Admin under Hunt; until then add people by hand.</div>` : null}
      ${!isLive ? html`<div class="small ink62" style=${{marginTop: '8px'}}>Apollo search runs on the EdgeOne address. Here, add people by hand.</div>` : null}
      ${ppl.err ? html`<div class="small flame-t" style=${{marginTop: '8px'}}>${ppl.err}</div>` : null}
      ${ppl.companies.length ? html`<div class="row" style=${{marginTop: '10px', gap: '6px'}} id="hunt-companies">
        ${ppl.companies.map(c => html`<button key=${c.id} type="button" class="chip" onClick=${() => { setDomain(c.domain); setBrand(c.name); ppl.findPeople(c.domain, titles, ''); }}>${c.name} <span class="num">${c.domain}</span></button>`)}
      </div>` : null}
      ${ppl.rows.length ? html`<div class="stack tight" style=${{marginTop: '12px'}} id="hunt-people">
        <div class="tiny sub num">${ppl.total} people found, ${ppl.rows.length} shown</div>
        ${ppl.rows.map(r => html`<div class="listrow hunt-person" key=${r.id}>
          ${r.photo ? html`<img class="av" src=${r.photo} alt="" width="32" height="32" style=${{borderRadius: '999px'}}/>` : html`<span class="av" style=${{width: '32px', height: '32px', borderRadius: '999px', background: 'var(--warm)', display: 'inline-block'}}/>`}
          <span class="grow" style=${{minWidth: 0}}>
            <span style=${{fontWeight: 500}}>${r.who}</span><span class="small ink62"> ${r.title}${r.org && r.org.name ? ' at ' + r.org.name : ''}${r.city ? ', ' + r.city : ''}</span>
            <span class="tiny sub" style=${{display: 'block'}}>${[r.hasMail ? 'work email on file' : 'no email on file', r.hasPhone ? 'a number on file' : 'no number on file', r.preview ? 'full name after Pursue' : ''].filter(Boolean).join(', ')}</span>
            ${r.linkedin ? html`<a class="tiny linky" href=${r.linkedin} target="_blank" rel="noopener" style=${{display: 'block'}}>${r.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</a>` : null}
          </span>
          <${UI.Btn} sm=${true} onClick=${() => onPursue({brand: brand.trim() || (r.org && r.org.name) || '', domain: domain.trim() || (r.org && r.org.domain) || '', company: (r.org && r.org.name) || brand.trim(),
            who: r.who, title: r.title, linkedin: r.linkedin, mail: r.mail, apolloId: r.id})}>Pursue<//>
        </div>`)}
      </div>` : null}
    <//>`;
  }

  /* ---------- one pursuit ---------- */
  function PursuitDrawer({id, onClose}) {
    const ctx = M.useCtx();
    const doc = ctx.coll.hunt.map[id];
    const [f, setF] = useState(() => doc ? U.clone(doc) : null);
    const [busy, setBusy] = useState('');
    const [tab, setTab] = useState('facts');
    const r = M.ai.useRun();
    const bank = bankOf(ctx);
    const isLive = live();
    useEffect(() => { if (doc && !f) setF(U.clone(doc)); }, [doc]);
    if (!doc) return html`<${UI.Drawer} open=${true} onClose=${onClose} title="This pursuit is gone"><${UI.Empty} text="Someone removed it."/><//>`;
    if (!f) return null;
    const p = {id, ...doc};
    const set = (k, v) => setF(x => ({...x, [k]: v}));
    const setA = (k, v) => setF(x => ({...x, audit: {...(x.audit || {}), [k]: v}}));
    const still = x => { const y = {...x}; ['copy', 'touches', 'updated', 'missing', 'step', 'closedUntil', 'created', 'owner'].forEach(k => { delete y[k]; }); return JSON.stringify(y); };
    const dirty = still(f) !== still(doc);
    const persist = async () => {
      const patch = {brand: f.brand, group: f.group, sub: f.sub, handle: f.handle, platform: f.platform, domain: f.domain, trigger: f.trigger, triggerNote: f.triggerNote, link: f.link,
        who: f.who, title: f.title, company: f.company, linkedin: f.linkedin, mail: f.mail, phone: f.phone, mutual: f.mutual, audit: f.audit || {},
        lane: f.lane, job: f.job, weeks: f.weeks, outputs: f.outputs, metric: f.metric, stage: f.stage, next: f.next || ''};
      const audited = has((f.audit || {}).posts) && (f.audit || {}).competitor;
      if (audited && patch.stage === 'found') patch.stage = 'audited';
      await save(ctx, id, patch);
      return {...p, ...patch};
    };
    const write = async () => {
      setBusy('write');
      try {
        const cur = await persist();
        let out;
        if (M.ai.on(ctx)) {
          try { out = await r.run(o => aiCopy(ctx, cur, bank, o)); } catch (e) { out = null; }
        }
        if (!out || !out.copy) out = writeCopy(cur, bank);
        await save(ctx, id, {copy: out.copy, missing: out.missing});
        setTab('copy');
        M.toast(out.copy.by === 'ai' ? 'Written from the audit' : (M.ai.on(ctx) ? 'Written from the template; the model did not answer' : 'Written from the template'));
      } catch (e) { M.toast((e && e.message) || 'That did not work.', true); }
      setBusy('');
    };
    const enrich = async phone => {
      if (!f.apolloId) return;
      setBusy(phone ? 'phone' : 'mail');
      try {
        const out = await api('huntenrich', {id: f.apolloId, phone});
        if (!out.row) { M.toast('Apollo has no record for this person', true); setBusy(''); return; }
        const row = out.row;
        const patch = {};
        if (row.mail) patch.mail = row.mail;
        if (row.phones && row.phones.length) patch.phone = row.phones[0].number;
        if (row.linkedin && !f.linkedin) patch.linkedin = row.linkedin;
        if (row.who && !row.preview) patch.who = row.who;
        if (row.title && !f.title) patch.title = row.title;
        if (Object.keys(patch).length) { setF(x => ({...x, ...patch})); await save(ctx, id, patch); }
        if (phone && !patch.phone) {
          if (out.phoneNeedsSite) M.toast('Phone reveal needs the https site address; it works on the EdgeOne address', true);
          else if (out.phonePending) {
            M.toast('Apollo is finding the number. It lands here in a minute.');
            for (let i = 0; i < 12; i++) {
              await new Promise(res => setTimeout(res, 5000));
              const ph = await api('huntphone', {id: f.apolloId}).catch(() => null);
              if (ph && ph.phones && ph.phones.length) { setF(x => ({...x, phone: ph.phones[0].number})); await save(ctx, id, {phone: ph.phones[0].number}); M.toast('Number found'); break; }
              if (ph && !ph.pending) { M.toast('Apollo has no number for this person', true); break; }
            }
          } else M.toast('Apollo has no number for this person', true);
        } else if (!phone && !patch.mail) M.toast('Apollo has no work email for this person', true);
      } catch (e) { M.toast((e && e.message) || 'That did not work.', true); }
      setBusy('');
    };
    const remove = async () => { try { await ctx.W.del('hunt/' + id); onClose(); M.toast('Removed'); } catch (e) { /* toasted */ } };
    const copy = doc.copy;
    const trig = TRIGGER_OF[f.trigger] || TRIGGER_OF.other;
    const lane = LANE_OF[f.lane] || LANES[0];
    const thinking = r.state === 'thinking' || r.state === 'streaming';
    const missing = Array.isArray(doc.missing) ? doc.missing : [];
    const head = html`<div class="row" style=${{gap: '6px', flexWrap: 'wrap'}}>
      <${UI.Seg} sm=${true} ariaLabel="Part" value=${tab} onChange=${setTab} options=${[{v: 'facts', label: 'Facts'}, {v: 'copy', label: 'Copy'}, {v: 'log', label: 'Log'}]}/>
      <${UI.Select} id="hunt-stage" value=${f.stage} onChange=${v => { set('stage', v); save(ctx, id, {stage: v}); }} options=${STAGES.map(s => ({v: s.v, label: s.label}))}/>
    </div>`;
    return html`<${UI.Drawer} open=${true} onClose=${onClose} title=${(f.who || 'Someone') + (f.brand ? ' at ' + f.brand : '')} head=${head}
      footer=${html`<${UI.ConfirmBtn} kind="sec" onConfirm=${remove}>Remove<//><span class="grow"/>
        ${tab !== 'copy' ? html`<${UI.Btn} kind="sec" disabled=${!dirty || !!busy} onClick=${() => persist().then(() => M.toast('Saved'))} id="hunt-save">Save<//>` : null}
        <${UI.Btn} disabled=${!!busy || thinking} onClick=${write} id="hunt-write">${thinking || busy === 'write' ? html`<${M.Thinking}/>` : html`<span class="spark">${SPARK}</span> ${copy ? 'Write it again' : 'Write the copy'}`}<//>`}>
      ${tab === 'facts' ? html`
        <div class="stack" style=${{gap: '14px'}}>
          <div>
            <${UI.Micro} plain>the person<//>
            <div class="grid2" style=${{marginTop: '6px'}}>
              <${UI.Input} id="hunt-who" label="name" value=${f.who} onChange=${v => set('who', v)} placeholder="Kingshuk Sen"/>
              <${UI.Input} id="hunt-title" label="title" value=${f.title} onChange=${v => set('title', v)} placeholder="Head of Digital"/>
              <${UI.Input} id="hunt-company" label="company" value=${f.company} onChange=${v => set('company', v)} placeholder="Tata Digital"/>
              <${UI.Input} id="hunt-linkedin" label="linkedin" value=${f.linkedin} onChange=${v => set('linkedin', v)} placeholder="https://www.linkedin.com/in/..."/>
              <${UI.Input} id="hunt-mail" label="work email" value=${f.mail} onChange=${v => set('mail', v)} placeholder=""/>
              <${UI.Input} id="hunt-phone" label="phone" value=${f.phone} onChange=${v => set('phone', v)} placeholder="+91"/>
              <${UI.Input} id="hunt-mutual" label="mutual or referrer" value=${f.mutual} onChange=${v => set('mutual', v)} placeholder="who suggested you write, if anyone" hint="The first WhatsApp names how you got the number."/>
            </div>
            ${isLive && f.apolloId ? html`<div class="row" style=${{gap: '6px', marginTop: '4px'}}>
              <${UI.Btn} kind="sec" sm=${true} disabled=${!!busy} onClick=${() => enrich(false)} id="hunt-enrich-mail">${busy === 'mail' ? 'Asking Apollo' : 'Get the work email'}<//>
              <${UI.Btn} kind="sec" sm=${true} disabled=${!!busy} onClick=${() => enrich(true)} id="hunt-enrich-phone">${busy === 'phone' ? 'Asking Apollo' : 'Get the number'}<//>
              <span class="tiny ink62">Each one spends an Apollo credit.</span>
            </div>` : null}
            ${f.linkedin ? html`<a class="small linky" href=${f.linkedin} target="_blank" rel="noopener">Open their LinkedIn</a>` : null}
          </div>
          <div>
            <${UI.Micro} plain>the brand and the trigger<//>
            <div class="grid2" style=${{marginTop: '6px'}}>
              <${UI.Input} id="hunt-p-brand" label="brand" value=${f.brand} onChange=${v => set('brand', v)} placeholder="Tata Sampann"/>
              <${UI.Input} id="hunt-sub" label="sub brand or handle" value=${f.sub} onChange=${v => set('sub', v)} placeholder="@tatasampann"/>
              <${UI.Select} id="hunt-platform" label="platform" value=${f.platform} onChange=${v => set('platform', v)} options=${PLATFORMS.map(x => ({v: x, label: x}))}/>
              <${UI.Select} id="hunt-trigger" label="why now" value=${f.trigger} onChange=${v => set('trigger', v)} options=${TRIGGERS.map(t => ({v: t.v, label: t.label}))} hint=${trig.when}/>
            </div>
            <${UI.TextArea} id="hunt-trigger-note" label="the trigger in one line" value=${f.triggerNote} onChange=${v => set('triggerNote', v)} rows=${2} placeholder="joined as Head of Digital in August, per exchange4media"/>
          </div>
          <div>
            <${UI.Micro} plain>the twenty minute audit, last 30 days on their handle<//>
            <div class="grid3" style=${{marginTop: '6px'}}>
              <${UI.Input} id="hunt-a-posts" label="posts" type="number" value=${f.audit.posts} onChange=${v => setA('posts', v)} placeholder="38"/>
              <${UI.Input} id="hunt-a-reels" label="reels of those" type="number" value=${f.audit.reels} onChange=${v => setA('reels', v)} placeholder="7"/>
              <${UI.Input} id="hunt-a-reach" label="reels reach, percent of followers" type="number" value=${f.audit.reach} onChange=${v => setA('reach', v)} placeholder="0.6"/>
              <${UI.Input} id="hunt-a-reply" label="days since a reply to a comment" type="number" value=${f.audit.replyDays} onChange=${v => setA('replyDays', v)} placeholder="9"/>
              <${UI.Input} id="hunt-a-creator" label="days since a creator post" type="number" value=${f.audit.creatorDays} onChange=${v => setA('creatorDays', v)} placeholder="40"/>
              <${UI.Input} id="hunt-a-lang" label="languages" value=${f.audit.languages} onChange=${v => setA('languages', v)} placeholder="English only"/>
              <${UI.Input} id="hunt-a-comp" label="competitor" value=${f.audit.competitor} onChange=${v => setA('competitor', v)} placeholder="Aashirvaad"/>
              <${UI.Input} id="hunt-a-compposts" label="competitor posts" type="number" value=${f.audit.compPosts} onChange=${v => setA('compPosts', v)} placeholder="52"/>
              <${UI.Input} id="hunt-a-compmult" label="times more, on the metric" type="number" value=${f.audit.compMult} onChange=${v => setA('compMult', v)} placeholder="4"/>
              <${UI.Input} id="hunt-a-compformat" label="their winning format" value=${f.audit.compFormat} onChange=${v => setA('compFormat', v)} placeholder="Hindi recipe reels"/>
              <${UI.Input} id="hunt-a-incumbent" label="incumbent agency, for your notes only" value=${f.audit.incumbent} onChange=${v => setA('incumbent', v)} placeholder="never written into the copy"/>
              <${UI.Input} id="hunt-a-quote" label="a public line from their CEO or CFO" value=${f.audit.quote} onChange=${v => setA('quote', v)} placeholder="staples growth from Bengal and Tamil Nadu"/>
            </div>
          </div>
          <div>
            <${UI.Micro} plain>the carve out<//>
            <div class="grid3" style=${{marginTop: '6px'}}>
              <${UI.Select} id="hunt-lane" label="the one job" value=${f.lane} onChange=${v => set('lane', v)} options=${LANES.map(l => ({v: l.v, label: l.label}))}/>
              <${UI.Input} id="hunt-weeks" label="weeks" type="number" value=${f.weeks} onChange=${v => set('weeks', v)} placeholder=${String(lane.weeks)}/>
              <${UI.Input} id="hunt-outputs" label="pieces" type="number" value=${f.outputs} onChange=${v => set('outputs', v)} placeholder=${String(lane.outputs)}/>
              <${UI.Input} id="hunt-job" label="in your words" value=${f.job} onChange=${v => set('job', v)} placeholder=${lane.job}/>
              <${UI.Input} id="hunt-metric" label="the one number" value=${f.metric} onChange=${v => set('metric', v)} placeholder=${lane.metric}/>
            </div>
            <div class="tiny ink62" style=${{marginTop: '4px'}}>Price, the proof, the spec link and the sign off come from Admin, Hunt.</div>
          </div>
        </div>`
      : tab === 'copy' ? (copy ? html`
        <div class="stack" style=${{gap: '14px'}} id="hunt-copyset">
          ${missing.length ? html`<div class="small flame-t" id="hunt-missing">Fill before sending: ${missing.join(', ')}. Square brackets mark the gaps.</div>` : null}
          <div class="tiny sub">${copy.by === 'ai' ? 'Written by the model from the audit' : 'Written from the template'}, ${U.timeAgo(copy.at)}</div>
          <${CopyBlock} label="the three lines" id="hunt-prop" text=${(copy.proposition || []).join('\n')} hint="paste anywhere"/>
          <${CopyBlock} label="linkedin connect note" id="hunt-connect" text=${copy.connect} channel="linkedin" p=${p} hint="under 300 characters"/>
          <${CopyBlock} label="linkedin message, after they accept" id="hunt-message" text=${copy.message} channel="linkedin" p=${p}/>
          <${CopyBlock} label="email" id="hunt-email" text=${'Subject: ' + copy.mailSubject + '\n\n' + copy.mailBody} channel="email" p=${p} hint="from your own mailbox, never the sequence"/>
          <${CopyBlock} label="whatsapp" id="hunt-whatsapp" text=${copy.whatsapp} channel="whatsapp" p=${p} hint="only after they accepted, replied or opened twice"/>
          <${CopyBlock} label="call opener" id="hunt-call" text=${copy.call} channel="call" p=${p} hint="between 10 and 1, Tuesday to Thursday"/>
          ${(copy.followups || []).map((t, i) => html`<${CopyBlock} key=${i} label=${'follow up ' + (i + 1)} id=${'hunt-fu-' + i} text=${t} channel="linkedin" p=${p}/>`)}
          <div>
            <${UI.Micro} plain>when they say<//>
            <div class="stack tight" style=${{marginTop: '6px'}} id="hunt-objections">
              ${(copy.objections || []).map((o, i) => html`<div key=${i} class="hunt-obj">
                <div class="row between"><b>${o.q}</b><${UI.Btn} kind="ghost" sm=${true} onClick=${() => copyText(o.a)}>Copy<//></div>
                <div class="small">${o.a}</div>
              </div>`)}
            </div>
          </div>
        </div>` : html`<${UI.Empty} text="Nothing written yet. Fill the audit and press Write the copy."/>`)
      : html`
        <div class="stack" style=${{gap: '12px'}} id="hunt-log">
          <div class="small">${doc.next ? 'Next touch ' + U.fmtDay(doc.next) + (doc.next < U.todayStr() ? ', overdue' : '') : 'No follow up scheduled. Press Sent on a piece of copy to start the ladder.'}</div>
          <div class="grid2">
            <${UI.Input} id="hunt-next" label="next touch" type="date" value=${f.next || ''} onChange=${v => set('next', v)}/>
            <${UI.Select} id="hunt-log-ch" label="log a touch" value="" onChange=${v => { if (v) markSent(ctx, p, v, 'logged by hand'); }} options=${[{v: '', label: 'Pick a channel'}].concat(CHANNELS)}/>
          </div>
          ${(doc.touches || []).length ? html`<div class="stack tight">${doc.touches.slice().reverse().map((t, i) => html`<div class="listrow" key=${i}>
            <${UI.Pill}>${(CHANNELS.find(c => c.v === t.channel) || {}).label || t.channel}<//>
            <span class="grow small">${t.note || ''}</span>
            <span class="tiny sub num">${U.timeAgo(t.at)}</span>
          </div>`)}</div>` : html`<${UI.Empty} text="No touches yet."/>`}
        </div>`}
    <//>`;
  }

  /* ---------- the page ---------- */
  function Hunt() {
    const ctx = M.useCtx();
    const [open, setOpen] = useState(null);
    const [seed, setSeed] = useState(null);
    const [show, setShow] = useState('open');
    const [q, setQ] = useState('');
    const all = pursuits(ctx);
    const td = U.todayStr();
    const pursue = async s => {
      try { const id = await create(ctx, s); setOpen(id); M.sound.play('soft'); } catch (e) { /* toasted */ }
    };
    M.useIntent('pursue', () => { const s = M.hunt.seed; M.hunt.seed = null; if (s) { setSeed(s); pursue(s); } });
    const needle = q.trim().toLowerCase();
    const match = p => !needle || [p.brand, p.who, p.title, p.company, p.sub].some(x => String(x || '').toLowerCase().includes(needle));
    const due = all.filter(p => isOpen(p) && p.next && p.next <= td).sort((a, b) => (a.next < b.next ? -1 : 1));
    const list = all.filter(p => (show === 'open' ? isOpen(p) : show === 'won' ? p.stage === 'won' : !isOpen(p) && p.stage !== 'won') && match(p))
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const counts = {open: all.filter(isOpen).length, sent: all.filter(p => (p.touches || []).length).length, replied: all.filter(p => ['replied', 'talking', 'pilot', 'won'].includes(p.stage)).length, won: all.filter(p => p.stage === 'won').length};
    const names = M.useProfiles(all.map(p => p.owner).filter(Boolean));
    return html`<div class="stack" style=${{gap: '14px'}} id="hunt">
      <div class="row" style=${{gap: '8px'}}>
        <span class="chipline"><b class="num">${counts.open}</b> in play</span>
        <span class="chipline"><b class="num">${counts.sent}</b> touched</span>
        <span class="chipline"><b class=${'num' + (counts.replied ? ' flame-t' : '')}>${counts.replied}</b> replied</span>
        <span class="chipline"><b class="num">${counts.won}</b> retainers</span>
        <span class="chipline"><b class=${'num' + (due.length ? ' flame-t' : '')}>${due.length}</b> due today</span>
      </div>
      ${due.length ? html`<${UI.Card} title="Due today" id="hunt-due" flame=${true}>
        <div class="stack tight">${due.map(p => html`<button type="button" key=${p.id} class="listrow rowbtn" onClick=${() => setOpen(p.id)}>
          <span class="grow"><b>${p.who || 'Someone'}</b> <span class="ink62">at ${p.brand || p.company}</span> <span class="tiny sub">touch ${Math.min(5, (Number(p.step) || 0) + 1)} of 5</span></span>
          <${UI.Pill} kind=${p.next < td ? 'flame-o' : 'outline'}>${p.next < td ? 'overdue' : 'today'}<//>
        </button>`)}</div>
      <//>` : null}
      <${Finder} onPursue=${pursue} seed=${seed}/>
      <${UI.Card} title="Pursuits" id="hunt-list" action=${html`<${UI.Seg} sm=${true} ariaLabel="Which pursuits" value=${show} onChange=${setShow} options=${[{v: 'open', label: 'In play'}, {v: 'won', label: 'Retainers'}, {v: 'closed', label: 'Closed'}]}/>`}>
        <div style=${{maxWidth: '360px', marginBottom: '10px'}}><${UI.Input} id="hunt-search" value=${q} onChange=${setQ} placeholder="Search a brand or a person"/></div>
        ${list.length ? html`<div class="stack tight">${list.map(p => html`<button type="button" key=${p.id} class="listrow rowbtn hunt-row" data-id=${p.id} onClick=${() => setOpen(p.id)}>
          <span class="grow" style=${{minWidth: 0}}>
            <span style=${{fontWeight: 500}}>${p.who || 'Someone'}</span> <span class="small ink62">${p.title || ''}${p.title && (p.brand || p.company) ? ', ' : ''}${p.brand || p.company || ''}</span>
            <span class="tiny sub" style=${{display: 'block'}}>${(TRIGGER_OF[p.trigger] || {}).label || ''}${p.triggerNote ? ': ' + clip(p.triggerNote, 90) : ''}</span>
          </span>
          ${p.copy ? html`<${UI.Pill} kind="warm">copy ready<//>` : null}
          ${p.next && isOpen(p) ? html`<span class="tiny sub num">${p.next <= td ? 'due' : U.fmtDay(p.next)}</span>` : null}
          <${UI.Pill} kind=${p.stage === 'won' ? 'ink' : ['replied', 'talking', 'pilot'].includes(p.stage) ? 'flame-o' : 'outline'}>${stageOf(p).label}<//>
          ${p.owner && p.owner !== ctx.uid ? html`<${UI.Avatar} id=${p.owner} size=${22} title=${(names[p.owner] || {}).name}/>` : null}
        </button>`)}</div>` : html`<${UI.Empty} text=${show === 'open' ? 'Nothing in play. Find a person above, or press Pursue on a Radar story.' : 'Nothing here yet.'}/>`}
      <//>
      <${UI.Fold} title="The playbook" summary="how big accounts are won, the week, the rules" id="fold-hunt-playbook">
      <${UI.Card} title="The playbook" id="hunt-playbook">
        <${UI.Micro} plain>how networks win these accounts, and the copyable version<//>
        <ol class="small hunt-list" style=${{margin: '6px 0 14px'}}>${HOW.map((t, i) => html`<li key=${i}>${t}</li>`)}</ol>
        <${UI.Micro} plain>the week<//>
        <div class="stack tight" style=${{margin: '6px 0 14px'}}>${WEEK.map((w, i) => html`<div class="listrow" key=${i}><span style=${{minWidth: '150px', fontWeight: 500}}>${w.d}</span><span class="grow small">${w.t}</span></div>`)}</div>
        <${UI.Micro} plain>never<//>
        <ul class="small hunt-list" style=${{margin: '6px 0 14px'}}>${DONT.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul>
        <${UI.Micro} plain>the groups that decide in India, brand by brand<//>
        <div class="row" style=${{gap: '6px', marginTop: '6px'}}>${TARGET_GROUPS.map(g => html`<${UI.Pill} key=${g}>${g}<//>`)}</div>
        <div class="tiny ink62" style=${{marginTop: '10px'}}>Targets a month: 80 accounts touched, 20 audits, 160 touches, 8 conversations, 3 pilots proposed, 1 pilot signed. Connect acceptance under 30 percent means the note is off; replies under 8 percent means line 1 is not specific enough; pilots without a signature after three months means line 3 is too big for the PO limit.</div>
      <//>
      <//>
      ${open ? html`<${PursuitDrawer} id=${open} onClose=${() => setOpen(null)}/>` : null}
    </div>`;
  }

  /* ---------- Admin: the Apollo key, the proof bank, the defaults ---------- */
  function HuntSettings() {
    const ctx = M.useCtx();
    const h = huntOf(ctx);
    const [key, setKey] = useState('');
    const [st, setSt] = useState(null);
    const [busy, setBusy] = useState(false);
    const fromSettings = x => ({teamSize: x.teamSize || '', phone: x.phone || '', link: x.link || '', price: x.price || '', signoff: x.signoff || '', perWeek: x.perWeek || '',
      proofs: [0, 1, 2].map(i => ({client: '', format: '', before: '', after: '', days: '', ...((x.proofs || [])[i] || {})}))});
    const [form, setForm] = useState(() => fromSettings(h));
    const [touched, setTouched] = useState(false);
    const saved = JSON.stringify(fromSettings(h));
    /* settings that arrive after the card mounted fill the form, until the founder starts typing */
    useEffect(() => { if (!touched) setForm(JSON.parse(saved)); }, [saved]);
    const isLive = live();
    const load = () => api('apollostatus').then(setSt).catch(() => setSt({configured: false}));
    useEffect(() => { if (isLive) load(); }, [isLive]);
    if (!ctx.isFounder) return null;
    const set = (k, v) => { setTouched(true); setForm(x => ({...x, [k]: v})); };
    const setProof = (i, k, v) => { setTouched(true); setForm(x => ({...x, proofs: x.proofs.map((p, j) => j === i ? {...p, [k]: v} : p)})); };
    const saveKey = async () => {
      setBusy(true);
      try { await api('apollokey', {key: key.trim()}); setKey(''); M.toast(key.trim() ? 'Apollo is on. Find people from Accounts, Hunt' : 'Apollo key removed'); load(); }
      catch (e) { M.toast((e && e.message) || 'Not saved', true); }
      setBusy(false);
    };
    const saveForm = () => ctx.W.merge('settings/app', {hunt: {...form, proofs: form.proofs.filter(p => p.client || p.after)}, updated: Date.now()}).then(() => { setTouched(false); M.toast('Hunt settings saved'); }).catch(() => {});
    return html`<${UI.Card} id="hunt-settings" title="Hunt" action=${isLive ? html`<${UI.Pill} kind=${st && st.configured ? 'ink' : 'outline'}>${st && st.configured ? 'Apollo on' : 'Apollo off'}<//>` : null}>
      <div class="stack" style=${{gap: '16px'}}>
        ${isLive ? html`<div>
          <${UI.Micro} plain>apollo<//>
          <div class="small ink62" style=${{margin: '4px 0 6px'}}>Apollo, Settings, Integrations, API: create a key and paste it here. It stays on the server; the team searches through it and never sees it. ${st && st.fromEnv ? 'This one is set on the server.' : st && st.configured ? 'Saved ' + U.timeAgo(st.at) + ', ending ' + st.hint.slice(-3) + '.' : ''}</div>
          <div class="row" style=${{gap: '8px'}}>
            <div class="grow" style=${{maxWidth: '520px'}}><${UI.Input} id="hunt-apollo-key" value=${key} onChange=${setKey} placeholder=${st && st.configured ? 'Paste a new key to replace the saved one' : 'Paste the Apollo API key'}/></div>
            <${UI.Btn} id="hunt-apollo-save" disabled=${busy || !key.trim()} onClick=${saveKey}>Save<//>
            ${st && st.configured && !st.fromEnv ? html`<${UI.ConfirmBtn} kind="sec" onConfirm=${() => { setKey(''); api('apollokey', {key: ''}).then(() => { load(); M.toast('Apollo key removed'); }).catch(() => {}); }}>Remove<//>` : null}
          </div>
        </div>` : html`<div class="small ink62">Apollo search runs on the EdgeOne address; the key is pasted there.</div>`}
        <div>
          <${UI.Micro} plain>the proof bank: three outcomes the copy leans on<//>
          <div class="stack tight" style=${{marginTop: '6px'}}>
            ${form.proofs.map((p, i) => html`<div class="grid3" key=${i} style=${{alignItems: 'end'}}>
              <${UI.Input} id=${'hunt-proof-client-' + i} label=${i === 0 ? 'client' : ''} value=${p.client} onChange=${v => setProof(i, 'client', v)} placeholder="Swisse Wellness UAE"/>
              <${UI.Input} label=${i === 0 ? 'format' : ''} value=${p.format} onChange=${v => setProof(i, 'format', v)} placeholder="Reels"/>
              <div class="row nowrap" style=${{gap: '6px'}}>
                <${UI.Input} label=${i === 0 ? 'before' : ''} value=${p.before} onChange=${v => setProof(i, 'before', v)} placeholder="4k views"/>
                <${UI.Input} id=${'hunt-proof-after-' + i} label=${i === 0 ? 'after' : ''} value=${p.after} onChange=${v => setProof(i, 'after', v)} placeholder="38k views"/>
                <${UI.Input} label=${i === 0 ? 'days' : ''} type="number" value=${p.days} onChange=${v => setProof(i, 'days', v)} placeholder="90"/>
              </div>
            </div>`)}
          </div>
        </div>
        <div>
          <${UI.Micro} plain>defaults in every note<//>
          <div class="grid3" style=${{marginTop: '6px'}}>
            <${UI.Input} id="hunt-team" label="team size" type="number" value=${form.teamSize} onChange=${v => set('teamSize', v)} placeholder="12"/>
            <${UI.Input} id="hunt-price" label="pilot price band" value=${form.price} onChange=${v => set('price', v)} placeholder="under 8 lakh, one PO"/>
            <${UI.Input} id="hunt-perweek" label="edits back a week" type="number" value=${form.perWeek} onChange=${v => set('perWeek', v)} placeholder="20"/>
            <${UI.Input} id="hunt-link" label="link to the spec pieces" value=${form.link} onChange=${v => set('link', v)} placeholder="https://"/>
            <${UI.Input} id="hunt-phone-default" label="your number, for the day 14 note" value=${form.phone} onChange=${v => set('phone', v)} placeholder="+91"/>
            <${UI.Input} id="hunt-signoff" label="sign off" value=${form.signoff} onChange=${v => set('signoff', v)} placeholder="Kaavish, Mask360, Mumbai"/>
          </div>
          <div class="row" style=${{marginTop: '10px'}}><${UI.Btn} sm=${true} onClick=${saveForm} id="hunt-settings-save">Save Hunt settings<//></div>
        </div>
      </div>
    <//>`;
  }
  HuntSettings.foldTitle = 'Hunt settings';
  HuntSettings.foldSummary = 'Apollo, the proof bank, the defaults';

  M.pages.Hunt = Hunt;
  M.adminCards.push(HuntSettings);
  M.hunt = {TRIGGERS, LANES, STAGES, OBJECTIONS, writeCopy, bankOf, seedFromNews, create, pursuits, seed: null,
    pursueFromNews: it => { M.hunt.seed = seedFromNews(it); M.intend('#hunt', 'pursue'); }};
})();
