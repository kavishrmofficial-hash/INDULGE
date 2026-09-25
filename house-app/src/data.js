/* Atenx House: seed data for the prototype. Every figure here is an example, set for the review build. */
const D = {};

D.club = {
  mark: 'HOUSE',
  cobrand: 'Atenx × Neeraj Chopra',
  house: 'No. 1 · Gurugram',
  address: 'Golf Course Road, Gurugram',
  hours: '05:30 to 23:00',
  fee: '₹1,50,000 a year',
  today: new Date(2026, 8, 25, 18, 20) // Friday 25 September 2026, evening
};

D.me = {
  id: 'me', name: 'Aarav Mehta', first: 'Aarav', handle: 'aarav.m', number: '0041', tier: 'Founding member',
  since: 'September 2026', discipline: 'Middle distance', work: 'Founder, Meridian Capital', city: 'Gurugram',
  bio: 'Runs 1500s at dawn, builds companies after. Here for the track and the people around it.',
  g: 'linear-gradient(135deg,#D7C08F,#8C6B3A)', atm: 'atm-portrait-c',
  sessions: 132, following: 38, followers: 24, passes: 4, passesTotal: 6, credits: 38500, creditsTotal: 50000,
  renews: '1 September 2027'
};

D.members = [
  {id:'riya', name:'Riya Kapoor', handle:'riya.k', role:'House coach', discipline:'Strength and conditioning', work:'Head of performance, House No. 1', city:'Gurugram', staff:true, g:'linear-gradient(135deg,#B9C9A8,#5D6B3C)', atm:'atm-portrait-c', bio:'Ten years with national track athletes. Programs every member block on the floor.', since:'Founding team', sessions:0, followers:412, following:60},
  {id:'priya', name:'Priya Menon', handle:'priya.m', role:'House physio', discipline:'Physiotherapy and recovery', work:'Lead physio, House No. 1', city:'Gurugram', staff:true, g:'linear-gradient(135deg,#C7B7A6,#6B4F3F)', atm:'atm-portrait-d', bio:'Runs the recovery floor: plunge, sauna, compression and the table.', since:'Founding team', sessions:0, followers:280, following:41},
  {id:'zara', name:'Zara Khan', handle:'zara.k', discipline:'Tennis', work:'Architect, Studio ZK', city:'New Delhi', g:'linear-gradient(135deg,#E2A07A,#7D3E52)', atm:'atm-portrait-a', bio:'Designs houses by day. Chasing a sub-20 5k and a better backhand.', since:'September 2026', sessions:48, followers:31, following:22},
  {id:'vikram', name:'Vikram Sethi', handle:'v.sethi', discipline:'Cycling', work:'Founder, Sethi Ventures', city:'Gurugram', g:'linear-gradient(135deg,#8FC3D6,#2F4E6A)', atm:'atm-portrait-b', bio:'Rides before the city wakes. Damdama loop most Sundays.', since:'September 2026', sessions:39, followers:19, following:27},
  {id:'ananya', name:'Ananya Iyer', handle:'ananya.i', discipline:'Triathlon', work:'Cardiac surgeon, Medanta', city:'Gurugram', g:'linear-gradient(135deg,#D9C37A,#7A6A2E)', atm:'atm-portrait-c', bio:'Long days in theatre, long swims after. Ironman 70.3 in March.', since:'September 2026', sessions:52, followers:44, following:18},
  {id:'kabir', name:'Kabir Malhotra', handle:'kabir.m', discipline:'Boxing', work:'Partner, Northwind Capital', city:'New Delhi', g:'linear-gradient(135deg,#C9A55E,#5A3A1E)', atm:'atm-portrait-d', bio:'Twelve rounds on Tuesdays. Converted to the cold room.', since:'September 2026', sessions:36, followers:27, following:33},
  {id:'meher', name:'Meher Bedi', handle:'meher.b', discipline:'Running', work:'Chef, Bedi & Sons', city:'Gurugram', g:'linear-gradient(135deg,#F2B48A,#B85C6B)', atm:'atm-portrait-a', bio:'Cooks the Founder’s table. Runs it off the next morning.', since:'September 2026', sessions:41, followers:58, following:30},
  {id:'dev', name:'Dev Nair', handle:'dev.n', discipline:'Swimming', work:'Fund manager, Kotak', city:'Mumbai', g:'linear-gradient(135deg,#9ED3E6,#2C6B8F)', atm:'atm-portrait-b', bio:'Open water when Mumbai allows it, the pool when it doesn’t.', since:'September 2026', sessions:22, followers:15, following:12},
  {id:'sana', name:'Sana Qureshi', handle:'sana.q', discipline:'Climbing', work:'Filmmaker', city:'New Delhi', g:'linear-gradient(135deg,#B8A2C8,#5A3E6B)', atm:'atm-portrait-a', bio:'Documentaries and boulders. Hosting the screening on the 7th.', since:'September 2026', sessions:29, followers:73, following:40},
  {id:'rohan', name:'Rohan Bhatia', handle:'rohan.b', discipline:'Golf', work:'Former first-class cricketer', city:'Gurugram', g:'linear-gradient(135deg,#C4D0A9,#3F7F63)', atm:'atm-portrait-c', bio:'Played 84 first-class games. Now plays 18 holes and lifts on Mondays.', since:'September 2026', sessions:33, followers:92, following:21},
  {id:'ishaan', name:'Ishaan Verma', handle:'ishaan.v', discipline:'Mobility', work:'Creative director', city:'Gurugram', g:'linear-gradient(135deg,#D8D2C0,#6C7A6A)', atm:'atm-portrait-d', bio:'Here for the studio and the sauna, in that order.', since:'September 2026', sessions:27, followers:35, following:29},
  {id:'tara', name:'Tara Singh', handle:'tara.s', discipline:'Marathon', work:'Senior counsel', city:'New Delhi', g:'linear-gradient(135deg,#E2A07A,#8A3B22)', atm:'atm-portrait-a', bio:'Mumbai Marathon in January. Looking for a long-run partner.', since:'September 2026', sessions:44, followers:26, following:24},
  {id:'arjun', name:'Arjun Reddy', handle:'arjun.r', discipline:'Powerlifting', work:'Orthopaedic surgeon', city:'Hyderabad', g:'linear-gradient(135deg,#8A7F6A,#4D473C)', atm:'atm-portrait-d', bio:'Fixes knees, deadlifts 240. Visiting from Hyderabad until the House there opens.', since:'September 2026', sessions:18, followers:22, following:16},
  {id:'naina', name:'Naina Joshi', handle:'naina.j', discipline:'Rowing', work:'Economist, RBI', city:'Mumbai', g:'linear-gradient(135deg,#9ED3E6,#3F5F7A)', atm:'atm-portrait-b', bio:'Erg at six, markets at nine.', since:'September 2026', sessions:25, followers:17, following:19},
  {id:'farhan', name:'Farhan Ali', handle:'farhan.a', discipline:'Football', work:'Photographer', city:'Gurugram', g:'linear-gradient(135deg,#D9C37A,#5D6B3C)', atm:'atm-portrait-c', bio:'Shoots the House. Plays on Thursdays.', since:'September 2026', sessions:31, followers:66, following:52},
  {id:'neeraj', name:'Neeraj Chopra', handle:'neeraj', role:'Co-founder', discipline:'Javelin', work:'Co-founder, the House', city:'Panipat', founder:true, g:'linear-gradient(135deg,#E6CB8E,#8C6B3A)', atm:'atm-track', bio:'Co-founded the House with Atenx. Runs Track night when he is in the country.', since:'Founding team', sessions:0, followers:1200, following:8}
];

D.inHouseNow = ['zara','kabir','meher','farhan','ishaan','ananya','rohan','vikram','tara','priya','riya','sana','dev','naina'];

D.events = [
  {id:'track', title:'Track night with Neeraj', date:'Fri 2 Oct', time:'19:30', when:'Friday 2 October, 7:30 pm', place:'The Track, House No. 1', atm:'atm-track', host:'neeraj', cap:8, going:['zara','kabir','farhan','rohan','tara'],
    blurb:'Eight members, one lane each. Neeraj runs the warm-up and the drills, then the last 400 is yours.', note:'Spikes optional. Doors to the track open at 19:00. Guests are not admitted to Track night.', tag:'neeraj'},
  {id:'table', title:'The Founder’s table', date:'Sat 3 Oct', time:'20:00', when:'Saturday 3 October, 8 pm', place:'The Dining Room', atm:'atm-table', host:'meher', cap:10, going:['ananya','vikram','ishaan','sana','naina','dev'],
    blurb:'Ten seats. Meher cooks around what the body wants after a hard week. Nothing fried, everything slow.', note:'One guest each. Seating is by the House. Tell the concierge about anything you do not eat.', tag:'tables'},
  {id:'plunge', title:'The cold room, opened', date:'Sun 4 Oct', time:'07:00', when:'Sunday 4 October, 7 am', place:'The Recovery Floor', atm:'atm-plunge', host:'priya', cap:12, going:['kabir','arjun','ananya'],
    blurb:'The plunge goes to 4°C this Sunday. Priya walks you through the protocol: breath, entry, three minutes, sauna after.', note:'Bring nothing. Towels and robes are on the floor.', tag:'recover'},
  {id:'screen', title:'Screening: Free Solo, with Sana Qureshi', date:'Wed 7 Oct', time:'21:00', when:'Wednesday 7 October, 9 pm', place:'The Screening Room', atm:'atm-screen', host:'sana', cap:24, going:['zara','ishaan','farhan','meher','tara','naina','dev','vikram'],
    blurb:'Sana introduces the film and stays for the argument after. Twenty-four seats, the bar is open.', note:'Members and one guest each.', tag:'talks'},
  {id:'dawn', title:'Dawn run, Aravalli', date:'Sat 10 Oct', time:'05:30', when:'Saturday 10 October, 5:30 am', place:'Leaves from the House', atm:'atm-dawn', host:'riya', cap:16, going:['tara','meher','ananya','zara'],
    blurb:'Fourteen kilometres through the Aravalli trails. Riya sets three pace groups. Breakfast at the House after.', note:'Cars leave the House at 05:15. Say if you want a seat.', tag:'train'},
  {id:'sleep', title:'Sleep as the first training session', date:'Wed 14 Oct', time:'19:00', when:'Wednesday 14 October, 7 pm', place:'The Library', atm:'atm-library', host:'riya', cap:30, going:['kabir','rohan','ishaan','naina','arjun'],
    blurb:'A talk with the House physiologist on why the night decides the morning, and what the data from 200 members says so far.', note:'Members only.', tag:'talks'},
  {id:'lab', title:'Assessment week', date:'19 to 23 Oct', time:'', when:'19 to 23 October', place:'The Lab', atm:'atm-lab', host:'riya', cap:0, going:[],
    blurb:'Your quarterly assessment: VO₂ max, body composition, force plate, blood panel. Forty minutes. Book a slot from the Form screen.', note:'Come fasted for the blood panel.', tag:'train'}
];

D.posts = [
  {id:'p1', who:'zara', ago:'2h', text:'First sub-20 5k on the House track this morning. Riya’s Tuesday intervals are brutal and they work.', img:'atm-track', cap:'The Track, 06:40', likes:12, likedBy:['kabir.m','meher.b'], comments:4},
  {id:'p2', who:'vikram', ago:'4h', text:'Anyone riding to Damdama on Sunday? Leaving the House at 05:45, back for the plunge.', likes:5, likedBy:['dev.n'], comments:3},
  {id:'p3', who:'meher', ago:'6h', text:'Menu for Saturday’s table is set. Slow-cooked lamb, black rice, a lot of greens. Tell the concierge if there is anything you do not eat.', img:'atm-table', cap:'The Dining Room', likes:21, likedBy:['ananya.i','sana.q'], comments:7},
  {id:'p4', who:'kabir', ago:'Yesterday', text:'Recovery 91% the morning after the plunge protocol. I was a sceptic. I am not any more.', likes:17, likedBy:['zara.k','arjun.r'], comments:5},
  {id:'p5', who:'tara', ago:'Yesterday', text:'Looking for a long-run partner for the Mumbai Marathon build. Sunday mornings, 25 to 30 km, conversational pace.', likes:8, likedBy:['meher.b'], comments:6},
  {id:'p6', who:'farhan', ago:'2d', text:'A few frames from Track night rehearsal. The lights on the back straight are something else.', img:'atm-floor', cap:'The Track, after dark', likes:34, likedBy:['zara.k','rohan.b'], comments:9}
];

D.tables = [
  {id:'t1', title:'Tuesday tempo group', when:'Tuesdays, 06:00', where:'The Track', host:'riya', cap:6, in:['zara','tara','meher','ananya']},
  {id:'t2', title:'Chess after strength', when:'Wednesdays, 08:00', where:'The Library', host:'ishaan', cap:4, in:['ishaan','kabir']},
  {id:'t3', title:'Sunday brunch after the plunge', when:'Sundays, 08:30', where:'The Dining Room', host:'meher', cap:8, in:['meher','vikram','dev','naina','sana','rohan']},
  {id:'t4', title:'Founders’ walk', when:'Fridays, 07:00', where:'Aravalli trail', host:'vikram', cap:8, in:['vikram','kabir','rohan']}
];

D.rooms = {
  train: [
    {id:'floor', name:'The Floor', sub:'Strength, with a coach on the floor', atm:'atm-floor', cap:8},
    {id:'track', name:'The Track', sub:'Indoor 60 m, six lanes', atm:'atm-track', cap:6},
    {id:'studio', name:'The Studio', sub:'Mobility and breath', atm:'atm-lab', cap:10},
    {id:'coach', name:'Coaching, one to one', sub:'Riya Kapoor', atm:'atm-court', cap:1}
  ],
  recover: [
    {id:'plunge', name:'The Plunge', sub:'6°C this week', atm:'atm-plunge', cap:4},
    {id:'sauna', name:'The Sauna', sub:'85°C, cedar', atm:'atm-table', cap:6},
    {id:'physio', name:'The Table', sub:'Physio with Priya', atm:'atm-portrait-d', cap:1},
    {id:'hbot', name:'The Chamber', sub:'Hyperbaric, 60 minutes', atm:'atm-lab', cap:2},
    {id:'sleep', name:'Sleep pods', sub:'Forty minutes, no phones', atm:'atm-screen', cap:3}
  ],
  courts: [
    {id:'padel1', name:'Padel 1', sub:'Covered court', atm:'atm-court', cap:4},
    {id:'padel2', name:'Padel 2', sub:'Covered court', atm:'atm-court', cap:4},
    {id:'squash', name:'Squash', sub:'Glass back', atm:'atm-floor', cap:2}
  ],
  table: [
    {id:'dine', name:'The Dining Room', sub:'Breakfast to 11, dinner from 7', atm:'atm-table', cap:40},
    {id:'bar', name:'The Bar', sub:'Members and guests', atm:'atm-library', cap:30}
  ]
};
D.slotTimes = ['06:00','07:00','08:00','09:00','10:00','12:00','17:00','18:30','19:30','20:30'];

D.bookings = [
  {id:'b1', room:'floor', name:'The Floor', sub:'Strength block with Riya', date:'Fri 25 Sep', time:'07:00', done:true},
  {id:'b2', room:'plunge', name:'The Plunge', sub:'6°C, three minutes', date:'Fri 25 Sep', time:'18:30'},
  {id:'b3', room:'physio', name:'The Table', sub:'Physio with Priya', date:'Sat 26 Sep', time:'10:00'}
];

/* seven days of form, Saturday 19 to Friday 25 September */
D.days = [
  {d:'S', n:19, recovery:62, hrv:58, rhr:52, sleep:6.4, need:7.8, strain:12.4, deep:1.3, rem:1.6, light:3.2, awake:.3},
  {d:'S', n:20, recovery:71, hrv:64, rhr:51, sleep:7.1, need:7.9, strain:9.8, deep:1.5, rem:1.7, light:3.6, awake:.3},
  {d:'M', n:21, recovery:84, hrv:72, rhr:49, sleep:7.9, need:7.6, strain:15.2, deep:1.7, rem:2.0, light:3.9, awake:.3},
  {d:'T', n:22, recovery:55, hrv:49, rhr:54, sleep:5.8, need:8.4, strain:6.1, deep:1.1, rem:1.3, light:3.1, awake:.3},
  {d:'W', n:23, recovery:68, hrv:61, rhr:52, sleep:6.9, need:8.1, strain:11.3, deep:1.4, rem:1.7, light:3.5, awake:.3},
  {d:'T', n:24, recovery:77, hrv:69, rhr:50, sleep:7.5, need:7.8, strain:14.0, deep:1.6, rem:1.9, light:3.7, awake:.3},
  {d:'F', n:25, recovery:78, hrv:71, rhr:49, sleep:7.7, need:7.8, strain:8.6, deep:1.6, rem:1.9, light:3.8, awake:.4, today:true}
];
D.baseline = {hrv:66, rhr:51};
D.assessment = {date:'12 September 2026', next:'19 to 23 October',
  rows:[
    {k:'VO₂ max', v:'54.2', u:'ml/kg/min', d:'+2.1', good:true},
    {k:'Body fat', v:'12.8', u:'%', d:'−0.9', good:true},
    {k:'Lean mass', v:'64.1', u:'kg', d:'+0.8', good:true},
    {k:'Jump height', v:'41', u:'cm', d:'+3', good:true},
    {k:'Grip', v:'58', u:'kg', d:'+2', good:true},
    {k:'Resting HR', v:'49', u:'bpm', d:'−2', good:true}
  ]};

D.houses = [
  {n:'01', city:'Gurugram', place:'Golf Course Road', status:'Open', open:true, atm:'atm-floor'},
  {n:'02', city:'New Delhi', place:'Lutyens’ Delhi', status:'Opening 2027', atm:'atm-library'},
  {n:'03', city:'Mumbai', place:'Bandra Kurla Complex', status:'Opening 2027', atm:'atm-plunge'},
  {n:'04', city:'Bengaluru', place:'Indiranagar', status:'Opening 2027', atm:'atm-court'},
  {n:'05', city:'Mumbai', place:'Worli Sea Face', status:'2028', atm:'atm-dawn'},
  {n:'06', city:'Hyderabad', place:'Jubilee Hills', status:'2028', atm:'atm-table'},
  {n:'07', city:'Chennai', place:'Boat Club Road', status:'2028', atm:'atm-track'},
  {n:'08', city:'Pune', place:'Koregaon Park', status:'2028', atm:'atm-lab'},
  {n:'09', city:'Bengaluru', place:'Sadashivanagar', status:'2029', atm:'atm-screen'},
  {n:'10', city:'Gurugram', place:'Aravalli, the last House', status:'2029', atm:'atm-dawn'}
];

D.ledger = [
  {t:'House credit', s:'₹50,000 a year against the table, the bar, guests and the lab', ico:'credit'},
  {t:'Guest passes', s:'Six a quarter. One guest per visit, signed in by you', ico:'guest'},
  {t:'The Lab', s:'Quarterly assessment: VO₂ max, body composition, force plate, bloods', ico:'lab'},
  {t:'Reciprocal Houses', s:'Six visits a year to any House in the network, from 2027', ico:'house'},
  {t:'Atenx', s:'Member pricing and first access to drops, in the House', ico:'tag'},
  {t:'The Founder’s table', s:'Priority for the ten seats each month', ico:'table'},
  {t:'Nomination', s:'You may nominate two people a year to the committee', ico:'nominate'}
];

D.notifications = [
  {t:'Riya confirmed your 07:00 strength block for tomorrow.', s:'12 min ago', ico:'calendar', go:'book'},
  {t:'Your form this morning: 78%. A green day, room for a hard session.', s:'06:14', ico:'form', go:'form'},
  {t:'Zara Khan started following you.', s:'Yesterday', ico:'person', go:'profile:zara'},
  {t:'Track night with Neeraj: three places left.', s:'Yesterday', ico:'star', go:'event:track'},
  {t:'The committee is reviewing your nomination of R. Kapoor. Decision in the first week of October.', s:'Tuesday', ico:'nominate', go:'nominate'},
  {t:'Doors open at 05:30 on Friday 2 October, Gandhi Jayanti hours.', s:'Monday', ico:'house', go:'today'}
];

D.threads = [
  {id:'concierge', name:'The House', sub:'Concierge, always on', house:true, msgs:[
    {who:'them', text:'Good evening, Aarav. Your plunge is at 18:30. Anything you need before?', t:'17:58'}
  ]},
  {id:'riya', name:'Riya Kapoor', sub:'House coach', msgs:[
    {who:'them', text:'Good block this morning. HRV is up on the week, so Saturday can be a hard one. Track intervals?', t:'09:12'},
    {who:'me', text:'Yes. What time works?', t:'09:30'},
    {who:'them', text:'07:00. I will hold lane 3.', t:'09:31'}
  ]},
  {id:'zara', name:'Zara Khan', sub:'Tennis', msgs:[
    {who:'them', text:'Are you doing Track night on the 2nd? Kabir says the lane next to Neeraj is cursed.', t:'Yesterday'}
  ]}
];
D.quickAsks = ['A car to the House at 17:45', 'Move my physio to Sunday', 'A table for two tonight', 'No dairy on Saturday, please', 'Is the sauna open tomorrow morning?'];
D.conciergeReplies = [
  'Done. I will confirm in a moment.',
  'Of course. Give me two minutes.',
  'Noted, and passed to the floor.',
  'Yes. I have put it on your day. Anything else?'
];
