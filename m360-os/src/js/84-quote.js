/* module: quote. A thought for the day on Home: one line that taps the mind, the same line for the
   whole team on a given day, drawn from the list below by the date. Nothing motivational, nothing
   borrowed; each line is a small provocation about seeing, making, deciding or noticing, written for
   people who make things for a living. Another shows the next one; the words rise in one by one. */
'use strict';
(function () {
  const {html, React, U} = M;
  const {useState, useEffect} = React;

  const LINES = [
    'The first idea is the one everyone has. Keep going until it surprises you.',
    'What would this look like if it were easy?',
    'You are not stuck. You are early.',
    'Name the thing you are avoiding. It gets smaller once it has a name.',
    'A brief is a question somebody forgot to ask out loud.',
    'Taste is pattern recognition with a memory. Feed it something new today.',
    'If you cannot explain the idea in a sentence, you have two ideas.',
    'The client is never wrong about the problem, only about the solution.',
    'Attention is the only budget that never grows. Spend it on purpose.',
    'Before you add, ask what one thing could go.',
    'Boredom is the mind asking for a harder question.',
    'Your best work this year will come from something you nearly did not say.',
    'Look at the thing you made yesterday as if someone else made it.',
    'The gap between a good idea and a great one is usually one more draft.',
    'What is the smallest version of this that would still be true?',
    'A deadline is a decision in disguise.',
    'Nobody remembers the safe version.',
    'Confusion at the start is normal. Confusion at the end is a sign.',
    'Say the uncomfortable thing in the meeting, kindly, early.',
    'What would you make if nobody would ever see it?',
    'The hard part is not the work. It is choosing which work.',
    'A rule you cannot explain is a habit wearing a badge.',
    'Walk before you decide. The legs think too.',
    'Most feedback is about the reader. Some of it is about the work. Learn to tell them apart.',
    'If it feels finished, ask what it is still hiding.',
    'Your calendar is a drawing of your priorities. Does it look like you?',
    'Make the version you would be a little embarrassed to show. Then fix the embarrassing part.',
    'Every brand is a promise somebody has to keep on a Tuesday.',
    'When two options feel equal, pick the one that teaches you more.',
    'Speed is a feeling you can design.',
    'A question you can answer in a sentence was not worth the meeting.',
    'Rest is not the opposite of work. It is where the work settles.',
    'What does the audience already believe that this has to respect?',
    'The thing you keep explaining is the thing you have not yet designed.',
    'Write the headline before the deck. If the headline is dull, the deck will not save it.',
    'Treat a constraint as a collaborator with strong opinions.',
    'You do not need more references. You need a point of view.',
    'Where is the one place in this that only we could have made?',
    'A clear no today is kinder than a slow maybe.',
    'Describe the work to a child. Whatever you leave out was decoration.',
    'Momentum is a series of small finishes. Finish something small before lunch.',
    'The audience does not owe you their attention. Earn the first second.',
    'What are you measuring because it is easy to measure?',
    'A good question stays with you on the drive home.',
    'The work is done when removing anything makes it worse.',
    'If everyone agrees quickly, somebody has not thought about it yet.',
    'Energy follows attention. Where did yours go this morning?',
    'A mistake you noticed is a draft. A mistake you defended is a habit.',
    'Pitch the idea to the person who will have to live with it.',
    'What is the sentence this whole project is trying to say?',
    'Craft is caring about the part nobody will ever thank you for.',
    'The best time to simplify was the first draft. The second best time is now.',
    'A plan survives when it says what you will not do.',
    'Make the strange thing. Someone has already made the normal one.',
    'When you cannot find the idea, change the room.',
    'You can only edit what exists. Get it onto the page.',
    'What would the most honest version of this say?',
    'An hour of focus beats a day of being available.',
    'Ask the client what success looks like on a Friday evening.',
    'If the idea needs a long explanation, the explanation is the idea.',
    'Delight lives in the second look.',
    'Every scroll is a tiny vote. Give people a reason to vote.',
    'Say less, and mean it more.',
    'Your first reaction is data. Your second reaction is judgment. Wait for the second.',
    'Deep work has a door. Close it on purpose.',
    'What does this look like a year from now, if it works?',
    'Make it right, then make it fast, then make it beautiful. Then look again.',
    'A good brief tells you what to leave alone.',
    'Which part of this would you fight for?',
    'Curiosity is a muscle. Ask one question you do not need the answer to.',
    'Beware the idea that is clever before it is useful.',
    'Repetition is how a brand becomes a memory.',
    'The person who says the quiet part is doing the team a favour.',
    'Decide what good enough means before you start, or you will never stop.',
    'What are you pretending not to know about this project?',
    'Tired eyes approve anything. Sleep, then sign off.',
    'The audience reads the mood before the message.',
    'Pick the one metric that would make the client call you on a Sunday.',
    'Simple is a result, never a starting point.',
    'If you are not a little nervous about the idea, it is probably familiar.',
    'The best feedback asks a question the work had not considered.',
    'Protect the morning. The afternoon can defend itself.',
    'A great brand sounds the same at a whisper and at a shout.',
    'You will not find the idea by looking harder. Look somewhere else.',
    'Notice what you skip when you are tired. That is where the work is thin.',
    'The draft you are protecting is the one to show first.',
    'What would make this worth sharing without being asked?',
    'Every detail is a decision. Make the small ones on purpose too.',
    'The question is rarely how. It is usually why now.',
    'Finish the day with a line you would be glad to read tomorrow.'
  ];

  /* the same line for everyone on a date: the day count since the epoch, scattered so neighbours differ */
  const dayIndex = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const pick = (d, offset) => LINES[(((dayIndex(d) * 7919) + (offset || 0)) % LINES.length + LINES.length) % LINES.length];
  M.quote = {lines: LINES, today: offset => pick(new Date(), offset || 0), at: (d, offset) => pick(d, offset || 0)};

  function Quote() {
    const [n, setN] = useState(0);
    const [seen, setSeen] = useState(0);
    const text = M.quote.today(n);
    const words = text.split(' ');
    useEffect(() => { setSeen(s => s + 1); }, [n]);
    const Beam = M.fx && M.fx.Beam ? M.fx.Beam : ({children}) => children;
    return html`<${Beam} on=${true} variant="colorful" strength=${1} duration=${5} dark=${true}><section class="card ink quote-card" id="quote-card" aria-label="A thought for the day">
      <div class="row between" style=${{alignItems: 'flex-start', gap: '16px'}}>
        <div class="grow" style=${{minWidth: 0}}>
          <div class="micro">${n ? 'another thought' : 'a thought for ' + U.dateLabel(new Date()).toLowerCase()}</div>
          <p class="quote-line" id="quote-line" key=${text}>${words.map((w, i) => html`<${React.Fragment} key=${i}><span class="quote-w" style=${{'--i': i}}>${w}</span>${i < words.length - 1 ? ' ' : ''}<//>`)}</p>
        </div>
        <${M.fx.Metal} kind="ink" circle=${true}><button type="button" class="iconbtn on-dark quote-next" id="quote-next" aria-label="Another thought" title="Another thought" onClick=${() => { M.haptic.buzz('tick'); M.sound.play('soft'); setN(x => x + 1); }}><${M.icons.refresh || M.icons.more}/></button><//>
      </div>
    </section><//>`;
  }
  M.parts.Quote = Quote;
})();
