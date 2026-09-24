/* module: tour. The onboarding walk the cursor buddy gives a new person: where everything lives, said out
   loud and pointed at, section by section. One script for everyone, a few extra stops for the founder.
   Done once per person (kept in their private state doc), replayable any time from Me or the palette. */
'use strict';
(function () {
  const VERSION = 2;

  /* each stop: the hash to open, what to point at (first visible match wins), and what to say */
  const STOPS = [
    {go: '#home', sel: '#checkin-card, #home-hero', title: 'Check in',
      say: 'Hi {name}, I am your m360 buddy. Every day starts right here. Check in when you sit down, office or home, and say how you are feeling. It takes two taps.'},
    {go: '#home', sel: '#fold-eod, #wrap-shipped, #home-hero', title: 'The EOD line',
      say: 'At seven in the evening, write your EOD line. What shipped, what is next, what is blocked. Three lines, thirty seconds, and Kaavish reads every one.'},
    {go: '#home', sel: '.sidebar .new-trigger, .topbar .new-trigger', title: 'New',
      say: 'New makes anything. A task, a post, kudos for someone, a project.'},
    {go: '#home', sel: '.side-ask, .topbar .iconbtn[aria-label="Search"]', title: 'Search',
      say: 'Search finds anything. A client, a contact, a task, a handbook page. Command K opens it from anywhere.'},
    {go: '#home', sel: '.bellbtn', title: 'Inbox',
      say: 'Your inbox. Tasks handed to you, mentions, kudos and decisions land here.'},
    {go: '#home', sel: '.side-tools .iconbtn[aria-label="Focus timer"], .quick-btn', title: 'Focus',
      say: 'Focus runs a timer on one task and banks the deep work. Points come from finished work, streaks and kudos.'},
    {go: '#tasks', sel: '.main h1, .main .card', title: 'Work',
      say: 'Work. Your tasks board. Drag a task across as it moves. Projects, the calendar and reviews sit in the tabs above.'},
    {go: '#clients', sel: '.main .card, .main h1', title: 'Accounts',
      say: 'Accounts. Every client we serve. Open one and you get its brain, its people, its news and a meeting prep note.'},
    {go: '#base', sel: '#base-q, .main .card', title: 'Base',
      say: 'Base is everyone we know. Search a name or a company here before you reach out, and add the people you talk to.'},
    {go: '#feed', sel: '.main .card, .main h1', title: 'Vibe',
      say: 'Vibe. Post an update, give kudos, run a poll, and see the leaderboard.'},
    {go: '#radar', sel: '.main .card, .main h1', title: 'Radar',
      say: 'Radar. Live news about our clients and the industry, plus awards and channels worth watching.'},
    {go: '#me', sel: '#fold-profile, .main .card', title: 'Me',
      say: 'Me. Your photo and profile, your leave, the handbook. If a number ever looks wrong, request a correction here and Kaavish approves it.'},
    {go: '#hq', founder: true, sel: '#fold-brief, .main h1', title: 'HQ',
      say: 'HQ. The intelligence brief reads every check in, task and pitch, and tells you who is slipping and which client needs love.'},
    {go: '#admin', founder: true, sel: '.main h1, .main .card', title: 'Admin',
      say: 'Admin. Invite people by email, the keys, the backups, and every change anyone ever made.'},
    {go: null, sel: '.buddy-home', title: 'Your buddy',
      say: 'And that is me. Hold Control and Option and just talk, or tap here and type. Ask where anything is, or tell me to do it, and I will take you there.'}
  ];

  const stateDoc = ctx => ctx && ctx.priv && ctx.priv.state;
  const local = {
    get: k => { try { return localStorage.getItem('m360.' + k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem('m360.' + k, v); } catch (e) { /* private window */ } }
  };

  M.tour = {
    VERSION,
    stops: ctx => STOPS.filter(s => !s.founder || (ctx && ctx.isFounder)),
    line: (stop, ctx) => {
      if (stop.custom) return String(stop.say || '');
      const full = ctx ? ((ctx.member && ctx.member.name) || (ctx.me && ctx.me.name) || '') : '';
      const nm = String(full).split(' ')[0];
      return String(stop.say).replace('{name}', nm || 'there');
    },
    /* seen already, on this device or on any device */
    seen: ctx => {
      const d = stateDoc(ctx);
      if (d && d.ready && d.data && d.data.tour && (d.data.tour.done || d.data.tour.asked)) return true;
      return local.get('tourSeen') === '1';
    },
    /* the private state doc is loaded, so a verdict can be made */
    ready: ctx => { const d = stateDoc(ctx); return !!(d && d.ready); },
    mark: async (ctx, how) => {
      local.set('tourSeen', '1');
      try {
        if (ctx && ctx.W && ctx.uid) await ctx.W.merge('data/users/' + ctx.uid + '/state', {tour: {[how === 'done' ? 'done' : 'asked']: Date.now(), v: VERSION}});
      } catch (e) { /* offline: the device remembers */ }
    },
    start: () => window.dispatchEvent(new CustomEvent('m360:tour'))
  };
})();
