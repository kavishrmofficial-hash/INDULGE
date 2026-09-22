/* m360 OS intelligence layer: Claude on the viewer's own account, plus live presence.
   Every prompt carries only the data this viewer may see. Members get their own work and
   team-visible facts; the founder gets the whole company. Nothing Claude says is stored
   except the viewer's own cached brief in their private space. */
'use strict';
(function () {
  const {html, React, U} = M;

  /* ---------- live presence: who has m360 open right now ---------- */
  const pageOf = () => (location.hash || '').replace(/^#/, '').split('/')[0] || 'home';
  M.usePresence = function usePresence(room, uid) {
    const [online, set] = React.useState({});
    React.useEffect(() => {
      if (!room || !uid) return;
      let un = null;
      const say = () => { try { room.presence({uid, page: pageOf(), at: Date.now()}).catch(() => {}); } catch (e) { /* offline is fine */ } };
      say();
      try {
        un = room.onPeers(ch => {
          const m = {};
          for (const p of ch.peers || []) {
            const u = p && p.presence && p.presence.uid;
            if (typeof u === 'string' && u) m[u] = {page: String(p.presence.page || ''), at: p.updatedAt || 0};
          }
          set(prev => {
            const a = Object.keys(prev).sort().map(k => k + prev[k].page).join('|');
            const b = Object.keys(m).sort().map(k => k + m[k].page).join('|');
            return a === b ? prev : m;
          });
        }, () => {});
      } catch (e) { un = null; }
      window.addEventListener('hashchange', say);
      return () => { if (un) un(); window.removeEventListener('hashchange', say); };
    }, [room, uid]);
    return online;
  };

  /* ---------- the voice every prompt starts with ---------- */
  const VOICE = [
    'You are m360, the AI built into the internal OS of Mask360, a boutique 360 marketing and creative agency',
    'for luxury and premium brands in Mumbai and the UAE. The founder is Kaavish. The team is small and fast.',
    'Voice: short, warm, direct, a little playful, Gen Z friendly. Zero corporate filler. Numbers over adjectives. No emoji.',
    'Never use em dashes or en dashes. Use names, never internal ids. Today is ' + U.dateLabel(new Date()) + '.',
    ''
  ].join('\n');

  const ERR = {
    not_granted: 'AI is off for you on this page.', sampling_disabled: 'AI is off for this account.',
    not_declared: 'AI is off for this page.', capability_disabled: 'AI is unavailable here.',
    capability_removed: 'AI is unavailable here.', rate_limited: 'Claude needs a breather. Try again in a minute.',
    session_expired: 'Sign in to Claude again, then retry.', refused: 'Claude passed on that one. Try asking differently.',
    invalid_json: 'That came back scrambled. Tap to try again.', prompt_too_large: 'Too much at once. Ask about a smaller slice.',
    tools_unavailable: 'Actions are unavailable here. Answers still work.', empty_completion: 'Nothing came back. Try rephrasing.',
    cancelled: 'Stopped.'
  };
  const OFF = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];

  const ai = M.ai = {};
  ai.VOICE = VOICE;
  ai.on = ctx => !!(ctx && ctx.sample);
  ai.errCopy = code => ERR[code] || 'Something glitched. Try again.';
  ai.isOff = code => OFF.indexOf(code) >= 0;

  ai.text = function (ctx, prompt, o) {
    o = o || {};
    if (!ctx.sample) return Promise.reject({code: 'not_declared', message: 'no sample'});
    const opts = {};
    if (o.onText) opts.onText = o.onText;
    if (o.signal) opts.signal = o.signal;
    if (o.tier) opts.modelTier = o.tier;
    if (o.tools) opts.tools = o.tools;
    else if (o.cache !== undefined) opts.cache = o.cache;
    return ctx.sample(VOICE + prompt, opts).then(r => r.text);
  };
  ai.json = function (ctx, prompt, o) {
    o = o || {};
    if (!ctx.sample || !ctx.sample.json) return Promise.reject({code: 'not_declared', message: 'no sample'});
    const opts = {};
    if (o.signal) opts.signal = o.signal;
    if (o.tier) opts.modelTier = o.tier;
    if (o.cache !== undefined) opts.cache = o.cache;
    return ctx.sample.json(VOICE + prompt, opts);
  };

  /* ---------- names ---------- */
  async function names(ctx) {
    const ids = ctx.activeMembers.map(m => m.uid);
    const ps = (ctx.user && ctx.user.profiles && ids.length) ? await ctx.user.profiles(ids) : {};
    const out = {};
    ids.forEach(id => { out[id] = (ps[id] && ps[id].name) || (ctx.members[id] && ctx.members[id].title) || 'Teammate'; });
    return out;
  }
  ai.names = names;
  /* find a teammate by a name Claude or a person typed ("aanya", "Aanya Mehta", "me") */
  ai.findMember = function (ctx, nm, typed) {
    const q = String(typed || '').trim().toLowerCase().replace(/^@/, '');
    if (!q || q === 'me' || q === 'myself' || q === 'i') return ctx.uid;
    let best = null;
    for (const m of ctx.activeMembers) {
      const full = String(nm[m.uid] || '').toLowerCase();
      if (!full) continue;
      if (full === q) return m.uid;
      if (!best && (full.split(/\s+/)[0] === q.split(/\s+/)[0] || full.indexOf(q) === 0)) best = m.uid;
    }
    return best;
  };

  /* ---------- data slices ---------- */
  const today = () => U.todayStr();
  function tasksOf(ctx) {
    const map = ctx.coll.tasks.map;
    return Object.keys(map).map(id => ({id, ...map[id]}));
  }
  function projName(ctx, id) { const p = ctx.coll.projects.map[id]; return p ? p.name : ''; }
  function clientName(ctx, id) { const c = ctx.coll.clients.map[id]; return c ? c.name : ''; }
  function att(ctx, uid) { return (M.att && M.att.dayStatus) ? M.att.dayStatus(ctx, uid, today()) : {status: 'none'}; }

  function taskLine(ctx, t, nm) {
    const bits = [t.title];
    if (nm && t.owner) bits.push('owner ' + (nm[t.owner] || 'someone'));
    bits.push(t.status);
    if (t.due) bits.push('due ' + t.due + (t.due < today() && t.status !== 'done' ? ' OVERDUE' : ''));
    if (t.priority === 'high') bits.push('high priority');
    const p = projName(ctx, t.project); if (p) bits.push('project ' + p);
    const c = clientName(ctx, t.client); if (c) bits.push('client ' + c);
    if (t.revisions) bits.push(t.revisions + ' revisions');
    return '- ' + bits.join(', ');
  }

  ai.meSlice = async function (ctx) {
    const nm = await names(ctx);
    const uid = ctx.uid, td = today();
    const mine = tasksOf(ctx).filter(t => t.owner === uid);
    const open = mine.filter(t => t.status !== 'done').sort((a, b) => String(a.due || '9') < String(b.due || '9') ? -1 : 1);
    const doneToday = mine.filter(t => t.status === 'done' && t.doneAt && U.ymd(new Date(t.doneAt)) === td);
    const touched = mine.filter(t => t.updated && U.ymd(new Date(t.updated)) === td && t.status !== 'done');
    const wk = U.isoWeek(new Date());
    const plan = (((ctx.coll.plan.map[uid] || {}).weeks || {})[wk] || {}).items || [];
    const rev = ((ctx.coll.review.map[uid] || {}).weeks || {})[wk] || {};
    const eods = (ctx.coll.eod.map[uid] || {}).days || {};
    const lastEod = Object.keys(eods).sort().pop();
    const a = att(ctx, uid);
    const lines = [
      'PERSON: ' + (nm[uid] || 'me') + ', ' + ((ctx.member && ctx.member.title) || 'team member'),
      'TIME NOW: ' + U.hhmm(Date.now()) + ', start time ' + ctx.startFor(uid) + ', EOD due by ' + ctx.settings.eodCut,
      'CHECK-IN TODAY: ' + (a.in ? a.status + ' at ' + U.hhmm(a.in) + (a.late ? ' (late)' : '') : 'not yet'),
      'OPEN TASKS (' + open.length + '):', ...open.slice(0, 25).map(t => taskLine(ctx, t)),
      'DONE TODAY:', ...(doneToday.length ? doneToday.map(t => '- ' + t.title) : ['- nothing yet']),
      'TOUCHED TODAY, STILL OPEN:', ...(touched.length ? touched.map(t => '- ' + t.title + ' (' + t.status + ')') : ['- none']),
      'THIS WEEK OUTCOMES:', ...(plan.length ? plan.map(p => '- ' + p.text + ((rev.marks || {})[p.id] ? ' [' + rev.marks[p.id] + ']' : '')) : ['- not set yet']),
      'LAST EOD (' + (lastEod || 'none') + '): ' + (lastEod ? 'shipped: ' + eods[lastEod].shipped + '; next: ' + (eods[lastEod].next || '') + '; blocked: ' + (eods[lastEod].blocked || 'none') : ''),
      'RULE FLAGS ON ME:', ...(ctx.myFlags.length ? ctx.myFlags.map(f => '- ' + ((M.rules && M.rules.NAMES[f.rule]) || f.rule) + ': ' + f.text) : ['- all clear'])
    ];
    return lines.join('\n');
  };

  ai.teamSlice = async function (ctx) {
    const nm = await names(ctx);
    const td = today();
    const tasks = tasksOf(ctx);
    const wk = U.isoWeek(new Date());
    const out = ['TEAM (' + ctx.activeMembers.length + ' people):'];
    for (const m of ctx.activeMembers) {
      const a = att(ctx, m.uid);
      const open = tasks.filter(t => t.owner === m.uid && t.status !== 'done');
      const over = open.filter(t => t.due && t.due < td);
      const plan = (((ctx.coll.plan.map[m.uid] || {}).weeks || {})[wk] || {}).items || [];
      const marks = ((((ctx.coll.review.map[m.uid] || {}).weeks || {})[wk]) || {}).marks || {};
      const eods = (ctx.coll.eod.map[m.uid] || {}).days || {};
      const recentBlock = Object.keys(eods).sort().slice(-3).map(d => eods[d].blocked).filter(Boolean);
      const pts = (M.points && M.points.pointsFor) ? M.points.pointsFor(ctx, m.uid, U.periodRange('week').from, U.periodRange('week').to) : null;
      const lad = (M.points && M.points.ladder) ? M.points.ladder(ctx, m.uid, new Date()).level : 'clear';
      const flags = ctx.flags.filter(f => f.uid === m.uid).map(f => (M.rules && M.rules.NAMES[f.rule]) || f.rule);
      /* lateness, location, points, ladder and flags are private to the person and the founder */
      const see = ctx.canSee(m.uid);
      const bits = [
        (nm[m.uid] || 'someone') + ' (' + (m.title || m.role) + (m.pod ? ', ' + m.pod : '') + ')',
        'today: ' + (a.in ? a.status + ' ' + U.hhmm(a.in) + (see && a.late ? ' LATE' : '') + (see && a.status === 'office' ? (a.verified ? ' verified' : ' unverified location') : '') : (a.status === 'leave' ? 'on leave' : 'not in')),
        ctx.online && ctx.online[m.uid] ? 'online now' : 'offline',
        open.length + ' open tasks, ' + over.length + ' overdue' + (over.length ? ' (' + over.slice(0, 3).map(t => t.title).join('; ') + ')' : ''),
        'outcomes this week ' + plan.length + ' planned' + (see ? ', ' + Object.values(marks).filter(x => x === 'hit').length + ' hit, ' + Object.values(marks).filter(x => x === 'miss').length + ' missed' : ''),
        see && pts ? 'points this week ' + pts.total : '',
        see ? 'ladder ' + lad : '',
        recentBlock.length ? 'recent blockers: ' + recentBlock.join(' | ') : '',
        see && flags.length ? 'flags: ' + flags.join(', ') : ''
      ].filter(Boolean);
      out.push('- ' + bits.join('; '));
    }
    const projects = Object.keys(ctx.coll.projects.map).map(id => ({id, ...ctx.coll.projects.map[id]})).filter(p => !p.archived && p.status !== 'done');
    out.push('PROJECTS:');
    projects.forEach(p => {
      const pr = (M.tasks && M.tasks.progress) ? M.tasks.progress(ctx, p.id) : {done: 0, total: 0, overdue: 0};
      out.push('- ' + p.name + ', status ' + p.status + ', owner ' + (nm[p.owner] || 'none') + ', due ' + (p.due || 'none') + ', ' + pr.done + ' of ' + pr.total + ' tasks done, ' + pr.overdue + ' overdue');
    });
    if (!projects.length) out.push('- none');
    out.push('OPEN TASKS BY OWNER (top 40):');
    tasks.filter(t => t.status !== 'done').sort((a, b) => String(a.due || '9') < String(b.due || '9') ? -1 : 1).slice(0, 40)
      .forEach(t => out.push(taskLine(ctx, t, nm)));
    if (ctx.isFounder) {
      const fin = (ctx.priv.finance && ctx.priv.finance.data) || {};
      const pm = (M.pitches && M.pitches.metrics) ? M.pitches.metrics(ctx) : null;
      out.push('PIPELINE (weighted ' + U.inr(pm ? pm.weighted : 0) + ' monthly):');
      Object.keys(ctx.coll.pitches.map).forEach(id => {
        const p = ctx.coll.pitches.map[id];
        const v = ((fin.pitch || {})[id] || {}).value;
        out.push('- ' + p.brand + ', stage ' + p.stage + (v ? ', ' + U.inr(v) + '/mo' : '') + (p.next ? ', next: ' + p.next + ' by ' + (p.nextDate || 'no date') : ''));
      });
      out.push('CLIENTS:');
      Object.keys(ctx.coll.clients.map).forEach(id => {
        const c = ctx.coll.clients.map[id];
        const mo = ((fin.clients || {})[id] || {}).monthly;
        const comp = (M.clients && M.clients.completeness) ? M.clients.completeness(c) : {filled: 0, total: 3};
        out.push('- ' + c.name + ', ' + c.status + (mo ? ', ' + U.inr(mo) + '/mo' : '') + ', brain ' + comp.filled + ' of 3 filled');
      });
      const en = (M.voice && M.voice.energyByWeek) ? M.voice.energyByWeek(ctx, 4) : [];
      out.push('TEAM ENERGY (anonymous pulse, last 4 weeks): ' + en.map(e => e.week + ' ' + (e.avg == null ? 'none' : e.avg.toFixed(1))).join(', '));
      const lat = (M.voice && M.voice.latest) ? M.voice.latest(ctx, 3) : [];
      lat.forEach(r => out.push('- pulse says: broken "' + (r.broken || '') + '", change "' + (r.change || '') + '"'));
      const pend = (M.leave && M.leave.pending) ? M.leave.pending(ctx) : [];
      out.push('LEAVE WAITING ON KAAVISH: ' + pend.length);
    }
    return out.join('\n');
  };

  /* ---------- actions Claude may take from Ask m360 ---------- */
  ai.tools = function (ctx, nm, log) {
    const say = (t) => { if (log) log(t); };
    const findTask = q => {
      const s = String(q || '').toLowerCase().trim();
      if (!s) return null;
      const all = tasksOf(ctx).filter(t => t.status !== 'done' || true);
      return all.find(t => t.id === q) || all.find(t => String(t.title).toLowerCase() === s) || all.find(t => String(t.title).toLowerCase().indexOf(s) >= 0) || null;
    };
    const tools = [{
      name: 'create_task',
      description: 'Create a task in m360 and assign it. Returns the created task. Use when someone asks to add, create, assign, remind or delegate work.',
      inputSchema: {type: 'object', properties: {
        title: {type: 'string', description: 'Short task title, starting with a verb'},
        owner: {type: 'string', description: 'First name of the teammate who owns it, or "me"'},
        due: {type: 'string', description: 'Due date as YYYY-MM-DD, optional'},
        priority: {type: 'string', enum: ['low', 'normal', 'high']},
        project: {type: 'string', description: 'Project name, optional'}
      }, required: ['title']},
      execute: async (input) => {
        const title = String(input.title || '').trim().slice(0, 140);
        if (!title) throw new Error('title is required');
        const owner = ai.findMember(ctx, nm, input.owner) || ctx.uid;
        const due = /^\d{4}-\d{2}-\d{2}$/.test(String(input.due || '')) ? String(input.due) : '';
        const pq = String(input.project || '').toLowerCase();
        const pid = pq ? Object.keys(ctx.coll.projects.map).find(id => String(ctx.coll.projects.map[id].name || '').toLowerCase().indexOf(pq) >= 0) || '' : '';
        const p = pid ? ctx.coll.projects.map[pid] : null;
        const id = U.uid();
        await ctx.W.set('tasks/' + id, {title, owner, client: (p && p.client) || '', project: pid, section: (p && p.sections && p.sections[0] && p.sections[0].id) || '',
          due, status: 'todo', priority: ['low', 'normal', 'high'].indexOf(input.priority) >= 0 ? input.priority : 'normal',
          link: '', revisions: 0, shown20: false, subtasks: {}, comments: {}, by: ctx.uid, created: Date.now(), updated: Date.now(), doneAt: null});
        say('Created "' + title + '" for ' + (nm[owner] || 'you') + (due ? ', due ' + U.fmtDay(due) : ''));
        return {ok: true, title, owner: nm[owner] || 'you', due: due || null};
      }
    }, {
      name: 'set_task_status',
      description: 'Move a task to todo, doing, review or done. Find it by its title. Returns the new status.',
      inputSchema: {type: 'object', properties: {
        task: {type: 'string', description: 'The task title or part of it'},
        status: {type: 'string', enum: ['todo', 'doing', 'review', 'done']}
      }, required: ['task', 'status']},
      execute: async (input) => {
        const t = findTask(input.task);
        if (!t) throw new Error('no task matches that title');
        if (t.owner !== ctx.uid && !ctx.isFounder) throw new Error('only the owner or Kaavish can move this task');
        const st = ['todo', 'doing', 'review', 'done'].indexOf(input.status) >= 0 ? input.status : null;
        if (!st) throw new Error('unknown status');
        const patch = {status: st, updated: Date.now(), doneAt: st === 'done' ? Date.now() : null};
        if (t.status === 'review' && (st === 'doing' || st === 'todo')) patch.revisions = (t.revisions || 0) + 1;
        await ctx.W.update('tasks/' + t.id, patch);
        say('Moved "' + t.title + '" to ' + st);
        return {ok: true, task: t.title, status: st};
      }
    }];
    if (ctx.isFounder) tools.push({
      name: 'reassign_task',
      description: 'Give an existing task to a different teammate. Find it by its title. Returns the new owner.',
      inputSchema: {type: 'object', properties: {
        task: {type: 'string', description: 'The task title or part of it'},
        owner: {type: 'string', description: 'First name of the new owner'}
      }, required: ['task', 'owner']},
      execute: async (input) => {
        const t = findTask(input.task);
        if (!t) throw new Error('no task matches that title');
        const owner = ai.findMember(ctx, nm, input.owner);
        if (!owner) throw new Error('no teammate by that name');
        await ctx.W.update('tasks/' + t.id, {owner, updated: Date.now()});
        say('Handed "' + t.title + '" to ' + nm[owner]);
        return {ok: true, task: t.title, owner: nm[owner]};
      }
    });
    return tools;
  };

  /* ---------- cached personal brief in the viewer's private space ---------- */
  ai.cachePath = ctx => 'data/users/' + ctx.uid + '/ai';
  ai.useCache = function (ctx) {
    return M.useDoc(ctx.db, ai.cachePath(ctx));
  };
  ai.saveCache = function (ctx, key, value) {
    return ctx.W.merge(ai.cachePath(ctx), {[key]: {date: today(), at: Date.now(), ...value}}).catch(() => {});
  };

  /* ---------- a tiny runner hook: idle, thinking, streaming, done, error ---------- */
  ai.useRun = function () {
    const [s, set] = React.useState({state: 'idle', text: '', err: null});
    const ctl = React.useRef(null);
    React.useEffect(() => () => { if (ctl.current) ctl.current.abort(); }, []);
    const run = React.useCallback(async (fn) => {
      if (ctl.current) ctl.current.abort();
      const c = new AbortController(); ctl.current = c;
      set({state: 'thinking', text: '', err: null});
      try {
        const out = await fn({signal: c.signal, onText: ({text}) => set(x => ({...x, state: 'streaming', text}))});
        if (c.signal.aborted) return null;
        set(x => ({state: 'done', text: typeof out === 'string' ? out : x.text, err: null, data: typeof out === 'string' ? null : out}));
        return out;
      } catch (e) {
        const code = (e && e.code) || 'upstream_error';
        if (code === 'cancelled') { set(x => ({...x, state: x.text ? 'done' : 'idle'})); return null; }
        set(x => ({state: 'error', text: (e && e.text) || x.text, err: code}));
        return null;
      }
    }, []);
    const stop = React.useCallback(() => { if (ctl.current) ctl.current.abort(); }, []);
    return {...s, run, stop, setText: t => set({state: 'done', text: t, err: null})};
  };

  /* ---------- render Claude's short markdown safely as React elements ---------- */
  function inline(t, k) {
    return String(t).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.length > 4 && p.slice(0, 2) === '**' && p.slice(-2) === '**' ? html`<b key=${k + i}>${p.slice(2, -2)}</b>` : p);
  }
  M.AIText = function AIText({text}) {
    const lines = String(text || '').replace(/\u2014|\u2013/g, ', ').split('\n');
    const out = []; let list = [];
    const flush = () => { if (list.length) { out.push(html`<ul key=${'u' + out.length} style=${{margin: '4px 0', paddingLeft: '20px'}}>${list.map((l, i) => html`<li key=${i} style=${{margin: '3px 0'}}>${inline(l, 'l' + i)}</li>`)}</ul>`); list = []; } };
    lines.forEach((ln, i) => {
      const t = ln.trim();
      if (/^[-*•]\s+/.test(t)) { list.push(t.replace(/^[-*•]\s+/, '')); return; }
      flush();
      if (!t) return;
      if (/^#{1,3}\s+/.test(t)) { out.push(html`<div key=${'h' + i} style=${{fontWeight: 800, marginTop: '8px'}}>${inline(t.replace(/^#{1,3}\s+/, ''), 'h' + i)}</div>`); return; }
      out.push(html`<p key=${'p' + i} style=${{margin: '4px 0'}}>${inline(t, 'p' + i)}</p>`);
    });
    flush();
    return html`<div class="ai-out">${out}</div>`;
  };

  M.Thinking = function Thinking({label}) {
    return html`<span class="row nowrap small" style=${{gap: '8px'}}><span class="thinking"><i/><i/><i/></span>${label || 'Thinking'}</span>`;
  };
})();
