/* module: tour. The onboarding walk m360 gives a new person: where everything lives, said out loud and
   ringed in flame (the live mark looks at it), section by section. v40: the stops point at the v7 shell,
   the sidebar on a desk and the tab bar on a phone. One script for everyone, a few extra stops for the founder.
   Done once per person (kept in their private state doc), replayable any time from Me or the palette. */
'use strict';
(function () {
  const VERSION = 2;

  /* each stop: the hash to open, what to point at (first visible match wins), and what to say */
  const STOPS = [
    {go: '#home', sel: '#checkin-card, #home-hero', title: 'Check in',
      say: 'Hi {name}, I am your m360 buddy. Every day starts right here. Check in when you sit down, office or home, and say how you are feeling. It takes two taps.'},
    {go: '#home', sel: '#fold-eod, #home-eod, #wrap-shipped, #home-hero', title: 'The EOD line',
      say: 'At seven in the evening, write your EOD line. What shipped, what is next, what is blocked. Three lines, thirty seconds, and Kaavish reads every one.'},
    {go: '#home', sel: '#sAsk, #tbAsk, .tb-ask', title: 'New',
      say: 'New makes anything from Ask m360. A task, a post, kudos for someone, a project: open it and pick the row.'},
    {go: '#home', sel: '#sAsk, #tbAsk, .tb-ask', title: 'Ask m360',
      say: 'Ask m360 finds anything and answers from live data. A client, a contact, a task, a handbook page, who is in. Command K or the slash key opens it from anywhere.'},
    {go: '#home', sel: '#sAsk, #tbAsk, .tb-ask', title: 'Inbox',
      say: 'Your inbox is the first row in Ask m360. Tasks handed to you, mentions, kudos and decisions land there.'},
    {go: '#home', sel: '.quick-btn[data-k="focus"], #sAsk, #tbAsk, .tb-ask', title: 'Focus',
      say: 'Focus runs a timer on one task and banks the deep work. It sits here on Home and in Ask m360. Points come from finished work, streaks and kudos.'},
    {go: '#chat', sel: '#chat-input, #chat-list', title: 'Chat',
      say: 'Chat. Rooms for the team, and direct messages that only the two of you see. At a name to pull someone in, at everyone for the whole team.'},
    {go: '#tasks', sel: '.main h1, .main .card', title: 'Work',
      say: 'Work. Your tasks board. Drag a task across as it moves. Projects, the calendar and reviews sit in the tabs above.'},
    {go: '#talks', sel: '#talk-who, .main .card', title: 'Accounts',
      say: 'Accounts. Type who you spoke to, the company and what was said, and m360 reminds you on the follow-up date. The pipeline and the clients sit in the tabs above.'},
    {go: '#base', sel: '#base-q, .main .card', title: 'Base',
      say: 'Base is everyone we know. Search a name or a company here before you reach out, and add the people you talk to.'},
    {go: '#feed', sel: '.main .card, .main h1', title: 'Vibe',
      say: 'Vibe. Post an update, give kudos, run a poll, and see the leaderboard.'},
    {go: '#office', sel: '.office-mascot, .office, .main h1', title: 'The office',
      say: 'The office. The studio as it is right now: who is in, who is away, and the m360 COO, a bot that helps Kaavish run the day, at the station of what it is doing. When Kaavish walks the floor or says something, everyone sees it live. Look around, and tap anything to see it.'},
    {go: '#radar', sel: '.main .card, .main h1', title: 'Radar',
      say: 'Radar. Live news about our clients and the industry, plus awards and channels worth watching.'},
    {go: '#mail', sel: '#mail-card, #google-connect, #google-unconfigured, .main .card', title: 'Workspace',
      say: 'Workspace. Your Gmail, your calendar and meetings, your drive, right here, once you sign in with Google.'},
    {go: '#web', sel: '#web-url, .main .card', title: 'Web',
      say: 'Web. A browser inside m360, with the team\'s bookmarks. Canva, Apollo, LinkedIn, all without leaving.'},
    {go: '#notes', sel: '#notes-new, #notes, .main .card', title: 'Notes',
      say: 'Your notes. Rough work, thoughts, anything. Nobody else can read them, and they save themselves as you type.'},
    {go: '#music', sel: '#music-add, .main .card', title: 'Music',
      say: 'Music. Paste a Spotify, Apple Music or YouTube link for the team, press play, and it keeps playing while you move around m360.'},
    {go: '#me', sel: '#fold-profile, .main .card', title: 'Me',
      say: 'Me. Your photo and profile, the character the office draws for you, your leave, the handbook. If a number ever looks wrong, request a correction here and Kaavish approves it.'},
    {go: '#hq', founder: true, sel: '#c-need, .main h1', title: 'HQ',
      say: 'HQ opens on Command. What needs you comes first, then the numbers, attendance, flags, the business, the team and clients.'},
    {go: '#admin', founder: true, sel: '.main h1, .main .card', title: 'Admin',
      say: 'Admin. Invite people by email, the keys, the backups, and every change anyone ever made.'},
    {go: null, sel: '#sAsk, #tbAsk, .tb-ask', title: 'm360 AI',
      say: 'And that is m360 AI, the m360 AI row in Ask m360. Hold Control and Option and just talk, or open it and type. Ask where anything is, or tell it what to do, and it takes you there.'}
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
