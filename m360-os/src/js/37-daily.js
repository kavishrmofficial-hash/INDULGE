/* module: daily. Five, the one shared puzzle of the day: a five letter word, six tries, the same word
   for everyone, seeded by the date. Letters that are in the word and in place go flame, letters in
   the word but elsewhere get a ring, the rest fade. The result card is spoiler free (a grid of
   squares and the try count) and the team sees a distribution of tries, never a ranking of people.
   One puzzle a day, no second one on demand: the ritual is the point, not the grind. */
'use strict';
(function () {
  const {html, React, U, UI} = M;
  const {useState, useEffect, useMemo} = React;

  const WORDS = ('about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among angle angry apart apple apply arena argue arise array aside asset audio audit avoid award aware badly baker basic basis beach began begin being below bench birth black blame blank blend bless blind block blood board boost booth bound brain brand brave bread break breed brief bring broad broke brown build built buyer cable carry catch cause chain chair chaos charm chart chase cheap check chest chief child chose civil claim class clean clear click climb clock close cloud coach coast could count court cover craft crash crazy cream crime cross crowd crown crude curve cycle daily dance dated dealt death debut delay depth doubt dozen draft drama drawn dream dress drink drive drove dying eager early earth eight elite empty enemy enjoy enter entry equal error event every exact exist extra faith false fault fiber field fifth fifty fight final first fixed flash fleet floor fluid focus force forth forty forum found frame frank fraud fresh front fruit fully funny giant given glass globe going grace grade grand grant grass grave great gross group grown guard guess guest guide happy harsh heart heavy hence horse hotel house human ideal image index inner input issue joint judge juice known label large laser later laugh layer learn lease least leave legal level light limit links lives local logic loose lower lucky lunch magic major maker march match maybe mayor meant media metal might minor minus mixed model money month moral motor mount mouse mouth movie music needs never newly night noise north noted novel nurse occur ocean offer often order other ought paint panel paper party peace phase phone photo piece pilot pitch place plain plane plant plate point pound power press price pride prime print prior prize proof proud prove queen quick quiet quite radio raise range rapid ratio reach ready refer relax reply right rival river robot roman rough round route royal rural scale scene scope score sense serve seven shall shape share sharp sheet shelf shell shift shine shirt shock shoot short shown sight since sixth sixty sized skill sleep slide small smart smile smoke solid solve sorry sound south space spare speak speed spend spent split spoke sport staff stage stake stand start state steam steel stick still stock stone stood store storm story strip stuck study stuff style sugar suite super sweet table taken taste teach teeth thank theme there these thick thing think third those three threw throw tight times tired title today topic total touch tower track trade train treat trend trial tried tries truck truly trust truth twice under undue union unity until upper upset urban usage usual valid value video virus visit vital voice waste watch water wheel where which while white whole whose woman women world worry worse worst worth would wound write wrong wrote young youth quote merch viral reels edits logos tweak hinge pixel vibes flame spark ember blaze').split(' ');
  const TRIES = 6;
  const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const today = () => U.todayStr();

  /* the word of the day, the same for everyone */
  const wordFor = ymd => WORDS[Math.floor(M.play.rng('five:' + ymd)() * WORDS.length)];
  /* score a guess: 2 in place, 1 elsewhere in the word, 0 not in it; doubles handled the usual way */
  function score(guess, word) {
    const out = [0, 0, 0, 0, 0], left = {};
    for (let i = 0; i < 5; i++) { if (guess[i] === word[i]) out[i] = 2; else left[word[i]] = (left[word[i]] || 0) + 1; }
    for (let i = 0; i < 5; i++) { if (out[i] !== 2 && left[guess[i]]) { out[i] = 1; left[guess[i]]--; } }
    return out.join('');
  }
  const myResult = (ctx, uid, ymd) => (((M.play.docOf(ctx, uid) || {}).days || {})[ymd || today()] || {}).five || null;
  /* who has played today: tries per person, for the distribution */
  const teamToday = ctx => ctx.activeMembers.map(m => ({uid: m.uid, r: myResult(ctx, m.uid)})).filter(x => x.r);

  async function record(ctx, result) {
    const td = today();
    const doc = U.clone(M.play.docOf(ctx));
    const days = {...(doc.days || {}), [td]: {...((doc.days || {})[td] || {}), five: result}};
    const keys = Object.keys(days).sort();
    if (keys.length > 90) { while (keys.length > 90) delete days[keys.shift()]; await ctx.W.set('play/' + ctx.uid, {...doc, days}); }
    else await ctx.W.merge('play/' + ctx.uid, {days: {[td]: {five: result}}});
    if (result.tries <= TRIES) await M.play.award(ctx, result.tries <= 3 ? 15 : 10, 'Five in ' + result.tries);
    else await M.play.award(ctx, 3, 'showing up to Five');
  }

  /* the browser keeps today's tries only */
  const sweep = td => { try { Object.keys(localStorage).filter(k => /^m360\.five:/.test(k) && k.indexOf(td) < 0).forEach(k => localStorage.removeItem(k)); } catch (e) { /* none */ } };
  function Five() {
    const ctx = M.useCtx();
    const td = today();
    useEffect(() => { sweep(td); }, [td]);
    const word = useMemo(() => wordFor(td), [td]);
    const done = myResult(ctx, ctx.uid);
    const [guesses, setGuesses] = useState(() => { const s = M.prefs.get('five:' + td, ''); return s ? s.split(',').filter(g => g.length === 5) : []; });
    const [cur, setCur] = useState('');
    const [shake, setShake] = useState(false);
    const [busy, setBusy] = useState(false);
    const rows = useMemo(() => guesses.map(g => score(g, word)), [guesses, word]);
    const over = !!done || guesses.length >= TRIES || rows.some(r => r === '22222');
    const keyState = useMemo(() => { const s = {}; guesses.forEach((g, gi) => { for (let i = 0; i < 5; i++) { const v = Number(rows[gi][i]); if ((s[g[i]] || -1) < v) s[g[i]] = v; } }); return s; }, [guesses, rows]);
    const submit = () => {
      if (over || busy) return;
      if (cur.length !== 5) { setShake(true); setTimeout(() => setShake(false), 400); M.sound.play('tick'); return; }
      const start = Number(M.prefs.get('five:start:' + td, '0')) || Date.now();
      if (!guesses.length) M.prefs.set('five:start:' + td, String(start));
      const next = guesses.concat(cur);
      M.prefs.set('five:' + td, next.join(','));
      setGuesses(next); setCur('');
      const sc = score(cur, word);
      if (sc === '22222' || next.length >= TRIES) {
        setBusy(true);
        const tries = sc === '22222' ? next.length : TRIES + 1;
        record(ctx, {tries, ms: Date.now() - start, rows: next.map(g => score(g, word)), at: Date.now()})
          .then(() => { if (sc === '22222') M.rain('🔥', document.getElementById('five-grid'), {n: tries <= 3 ? 72 : 40}); })
          .catch(() => {}).then(() => setBusy(false));
      } else M.sound.play('soft');
    };
    const press = k => {
      if (over) return;
      if (k === 'enter') submit();
      else if (k === 'back') setCur(c => c.slice(0, -1));
      else if (cur.length < 5 && /^[a-z]$/.test(k)) setCur(c => c + k);
    };
    useEffect(() => {
      const h = e => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.key === 'Enter') { e.preventDefault(); press('enter'); }
        else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
        else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    });
    const team = teamToday(ctx);
    const dist = Array.from({length: TRIES + 1}, (_, i) => team.filter(t => t.r.tries === i + 1));
    const mineTries = done ? done.tries : null;
    const shown = done ? (done.rows || rows) : rows;
    return html`<${UI.Card} id="five" title="Five" action=${html`<span class="tiny ink62 num">${U.fmtDay(td)} · ${team.length} of ${ctx.activeMembers.length} played</span>`}>
      <div class="split" style=${{gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)'}}>
        <div class="stack tight">
          <div class="small">One word, five letters, six tries. Same word for everyone today. Flame means in place, a ring means in the word, faded means not in it.</div>
          <div class=${'five-grid' + (shake ? ' shake' : '')} id="five-grid" role="grid" aria-label="Your tries" data-hotkeys=${over ? undefined : '1'}>
            ${Array.from({length: TRIES}, (_, r) => html`<div key=${r} class="five-row" role="row">
              ${Array.from({length: 5}, (_, c) => {
                const g = r < guesses.length ? guesses[r] : (r === guesses.length && !over ? cur : '');
                const st = r < shown.length ? shown[r][c] : '';
                return html`<span key=${c} role="gridcell" class=${'five-cell' + (st === '2' ? ' ok' : st === '1' ? ' near' : st === '0' ? ' out' : g[c] ? ' typed' : '')}>${over && done && !guesses.length ? '' : (g[c] || '')}</span>`;
              })}
            </div>`)}
          </div>
          ${over ? html`<div class="small" id="five-done">${mineTries && mineTries <= TRIES ? html`Got it in <b class="num">${mineTries}</b>${done && done.ms ? html`, <span class="num">${M.play.fmtMs(done.ms)}</span>` : ''}. ${mineTries <= 2 ? 'Absurd.' : mineTries <= 3 ? 'Sharp today.' : mineTries <= 4 ? 'Solid.' : 'Made it.'} Tomorrow brings a new one.`
            : html`Not today. It was <b>${word}</b>. Tomorrow brings a new one.`}</div>`
          : html`<div class="five-keys" aria-label="Keyboard">
            ${KEYS.map((row, ri) => html`<div key=${ri} class="five-krow">
              ${ri === 2 ? html`<button type="button" class="key wide" onClick=${() => press('enter')}>Enter</button>` : null}
              ${row.split('').map(k => html`<button type="button" key=${k} class=${'key' + (keyState[k] === 2 ? ' ok' : keyState[k] === 1 ? ' near' : keyState[k] === 0 ? ' out' : '')} onClick=${() => press(k)} aria-label=${k}>${k}</button>`)}
              ${ri === 2 ? html`<button type="button" class="key wide" aria-label="Backspace" onClick=${() => press('back')}>Del</button>` : null}
            </div>`)}
          </div>`}
        </div>
        <div class="stack tight" id="five-team">
          <div class="small"><b>The team today.</b> Tries, not names in order. Nobody sees your letters.</div>
          <div class="five-dist">
            ${dist.map((who, i) => html`<div key=${i} class="five-bar row nowrap">
              <span class="tiny num five-lab">${i < TRIES ? i + 1 : 'X'}</span>
              <span class="five-track"><i style=${{width: (team.length ? Math.round(100 * who.length / team.length) : 0) + '%'}}/></span>
              <span class="row nowrap" style=${{gap: '2px'}}>${who.length ? html`<${UI.AvatarRow} ids=${who.map(w => w.uid)} size=${18}/>` : null}</span>
            </div>`)}
          </div>
          ${done ? html`<div class="five-card" id="five-share" aria-label="Your result card">
            <div class="tiny ink62">Your card</div>
            <div class="five-mini">${(done.rows || []).map((r, i) => html`<div key=${i} class="five-mrow">${r.split('').map((s, j) => html`<i key=${j} class=${s === '2' ? 'ok' : s === '1' ? 'near' : 'out'}/>`)}</div>`)}</div>
            <div class="tiny num">Five ${U.fmtDay(td)} · ${done.tries <= TRIES ? done.tries + '/' + TRIES : 'X/' + TRIES}</div>
          </div>` : html`<div class="tiny ink62">Your card shows here once you are done. It goes to the feed, squares only.</div>`}
        </div>
      </div>
    <//>`;
  }

  M.parts.Daily = Five;
  M.play.five = {WORDS, TRIES, wordFor, score, myResult, teamToday};
  M.play.puzzleFor = ymd => ({kind: 'five', word: wordFor(ymd)});
  M.play.kindFor = () => 'five';
})();
