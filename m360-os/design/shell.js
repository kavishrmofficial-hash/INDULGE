/* REACT reference (React 18 + htm): the app frame with the glass sidebar, phone capsule, tab bar and menu.
   Port the markup and class names; keep this OS's own data hooks, auth and routing. */
/* ---------------- shell ---------------- */
function Gate(p){ return html`<div class="gate"><div class="gate-in"><div class="gmark"><${LiveMark} /></div><h1>${p.title}</h1><p>${p.text}</p></div></div>`; }
function JoinGate(p){ return html`<div class="gate"><div class="gate-in"><div class="gmark"><${LiveMark} /></div><h1>Hi ${p.name}</h1><p>${p.sent ? 'Request sent. '+p.founder+' adds you from the Desk, and the OS opens the next time you load this link.' : 'You\'re signed in, but not on the team roster yet.'}</p>${p.sent?null:html`<div class="row gap"><button class="btn" onClick=${p.onAsk}>Ask to join</button></div>`}</div></div>`; }
function Side(p){
  var ref=useRef(null);
  useEffect(function(){ SB.mount(ref.current); },[]);
  useEffect(function(){ SB.place(false); });
  var j=0;
  return html`<aside class="side" id="side" ref=${ref} aria-label="Pages">
    <button class="sbt" type="button" aria-label="m360, back to top" onClick=${function(){ MK.spin(); glide(0); }}><${LiveMark} /></button>
    <nav class="snav"><span class="sp sp-h"></span><span class="sp sp-a"></span><i class="here"></i>
      ${p.groups.map(function(g){ return html`<${React.Fragment} key=${g.g||'top'}>${g.g?html`<div class="sgl"><span>${g.g}</span></div>`:null}${g.items.map(function(n){ var jj=j++; return html`<button key=${n[0]} type="button" class=${cls('nv', p.page===n[0]&&'on')} data-t=${n[1]} data-k=${n[0]} style=${{'--j':jj}} aria-current=${p.page===n[0]?'page':null} onClick=${function(){ p.go(n[0]); }}>${n[2]}<span class="nl">${n[1]}</span>${n[3]?html`<b class="bd">${n[3]}</b>`:null}</button>`; })}<//>`; })}
    </nav>
    <div class="sfoot">
      <button class="nv" id="sAsk" type="button" data-t="Ask m360" data-kb="⌘K" style=${{'--j':j}} onClick=${function(){ ISL.cmd(''); }}>${I.search}<span class="nl">Ask m360</span><kbd class="kb">⌘K</kbd></button>
      <button class="nv" id="sTog" type="button" data-t=${p.sbx?'Collapse':'Expand'} data-kb="[" aria-expanded=${p.sbx?'true':'false'} style=${{'--j':j+1}} onClick=${function(){ SB.toggle(); }}>${I.panel}<span class="nl">${p.sbx?'Collapse':'Expand'}</span></button>
      <button class="nv" type="button" data-t=${p.meName} style=${{'--j':j+2}} onClick=${function(){ p.go('people/'+p.meId); }}><${Av} prof=${p.me} size=${22} /><span class="nl">${p.meName}<small>${p.sub}</small></span></button>
    </div></aside>`;
}
function TabBar(p){
  var ref=useRef(null);
  useEffect(function(){ TB.place(ref.current); });
  useEffect(function(){ var f=function(){ TB.place(ref.current,true); }; addEventListener('resize',f); return function(){ removeEventListener('resize',f); }; },[]);
  return html`<nav class="tabbar" id="tabbar" ref=${ref} aria-label="Tabs"><div class="tbg lg"><span class="lens"></span>
    ${p.tabs.map(function(n){ return html`<button key=${n[0]} type="button" class=${cls('ptab', p.page===n[0]&&'on')} aria-current=${p.page===n[0]?'page':null} onClick=${function(){ p.go(n[0]); }}>${n[2]}<span>${n[1]}</span>${n[3]?html`<b class="bd">${n[3]}</b>`:null}</button>`; })}
    <button type="button" class=${cls('ptab', p.moreOn&&'on')} onClick=${p.onMore}>${I.more}<span>More</span>${p.moreDot?html`<i class="tdot"></i>`:null}</button></div>
    <button class="tb-ask lg" type="button" aria-label="Ask m360" onClick=${function(){ ISL.cmd(''); }}>${I.search}</button></nav>`;
}
function Menu(p){
  var s=useState(false); var on=s[0], setOn=s[1]; var cb=useRef(p.onClose); cb.current=p.onClose; var gone=useRef(false);
  function close(){ if(gone.current) return; gone.current=true; setOn(false); setTimeout(function(){ cb.current(); },300); }
  useEffect(function(){ document.documentElement.classList.add('mn-open'); var r=requestAnimationFrame(function(){ requestAnimationFrame(function(){ setOn(true); }); });
    var f=function(e){ if(e.key==='Escape') close(); }; addEventListener('keydown',f);
    return function(){ cancelAnimationFrame(r); document.documentElement.classList.remove('mn-open'); removeEventListener('keydown',f); }; },[]);
  var j=0;
  return html`<div class=${cls('menu', on&&'open')} role="dialog" aria-modal="true" aria-label="Menu">
    <div class="menu-top"><span class="pm"><${LiveMark} /></span><button class="shx" type="button" aria-label="Close menu" onClick=${close}>${I.x}</button></div>
    <div class="menu-list">${p.groups.map(function(g){ return html`<div key=${g.g||'top'}>${g.g?html`<div class="grp">${g.g}</div>`:null}${g.items.map(function(n){ var jj=j++; return html`<button key=${n[0]} type="button" class=${cls('mi', p.page===n[0]&&'on')} style=${{'--j':jj}} onClick=${function(){ p.go(n[0]); close(); }}>${n[2]}<span>${n[1]}</span>${n[3]?html`<b class="bd">${n[3]}</b>`:null}</button>`; })}</div>`; })}</div></div>`;
}

function App(){
  var pf=usePlatform(); var db=pf.mode==='ok'?pf.db:null; var meId=pf.me&&pf.me.id; var now=useNow(60000);
  var roster=useDocSnap(db,'roster/team'); var settingsDoc=useDocSnap(db,'settings/app');
  var C={}; ['checkin','eod','plan','review','rocks','feed','reacts','acks','kudos','leave','leavedec','tasks','projects','pitches','clients','handbook','candidates','pulse','ideas','votes','access','onboard','joinreq'].forEach(function(k){ C[k]=useColl(db,k); });
  var joinMine=useDocSnap(db, meId?'joinreq/'+meId:null);
  var evalsColl=useColl(pf.mode==='ok'&&pf.owner?db:null,'evals'); var evalsMine=useDocSnap(pf.mode==='ok'&&!pf.owner?db:null, meId?'evals/'+meId:null);
  var keeperPath=meId?'data/users/'+meId+'/keeper':null, finPath=meId?'data/users/'+meId+'/finance':null, statePath=meId?'data/users/'+meId+'/state':null;
  var keeper=useDocSnap(pf.mode==='ok'&&pf.owner?db:null, keeperPath); var finance=useDocSnap(pf.mode==='ok'&&pf.owner?db:null, finPath); var stateDoc=useDocSnap(db, statePath);
  var tb=useHash(''); var hash=tb[0], setHash=tb[1]; var boot=useRef(false);
  var mn=useState(false); var menu=mn[0], setMenu=mn[1];
  var sbS=useState(document.documentElement.classList.contains('sbx')); var sbx=sbS[0], setSbx=sbS[1];
  var seenEv=useRef(null);
  var w=useMemo(function(){ return db?mkWriter(db):null; },[db]);
  useEffect(function(){ var f=function(x){ setSbx(!!x); }; EVB.on('sb',f); return function(){ EVB.off('sb',f); }; },[]);
  useEffect(function(){ if(!db || !pf.owner || !roster.ready || boot.current) return; var m=(roster.data&&roster.data.members)||{}; if(!m[pf.me.id] || !m[pf.me.id].empId){ boot.current=true; var cur=clone(roster.data)||{members:{},nextEmp:1}; cur.members=cur.members||{}; var ex=cur.members[pf.me.id]||{}; if(!ex.empId){ ex.empId=cur.nextEmp||1; cur.nextEmp=(cur.nextEmp||1)+1; } cur.members[pf.me.id]=Object.assign({role:'founder', title:'Founder', pod:'', joined:todayStr(), active:true}, ex); cur.updated=Date.now(); w.set('roster/team', cur); } },[db, pf.owner, roster.ready, roster.data]);
  var rosterData=roster.data||{members:{},nextEmp:1}; var ids=orderIds(rosterData, activeIds(rosterData));
  var founderId=Object.keys(rosterData.members||{}).find(function(id){ return (rosterData.members[id]||{}).role==='founder'; })||(pf.owner&&pf.me?pf.me.id:null);
  var allIds=Object.keys(rosterData.members||{}); var extra=[]; Object.keys(C.tasks.map).forEach(function(k){ var o=C.tasks.map[k].owner; if(o&&allIds.indexOf(o)<0&&extra.indexOf(o)<0) extra.push(o); });
  Object.keys(C.joinreq.map).forEach(function(k){ if(allIds.indexOf(k)<0&&extra.indexOf(k)<0) extra.push(k); });
  var prof=useProfiles(pf.mode==='ok'?pf.user:null, allIds.concat(extra).concat(meId?[meId]:[]));
  var me=pf.me?pf.me.id:null; var isFounder=!!pf.owner; var mem=me?(rosterData.members||{})[me]:null;
  function nm(id){ if(id===me && pf.me && pf.me.name) return pf.me.name; return (prof[id]&&prof[id].name)||'Someone'; }
  var settings=Object.assign({}, DEF_SETTINGS, settingsDoc.data||{});
  var hbIds=Object.keys(C.handbook.map).sort(function(a,b){ return (C.handbook.map[a].order||99)-(C.handbook.map[b].order||99) || String(C.handbook.map[a].title).localeCompare(String(C.handbook.map[b].title)); });
  var pinKey=((C.feed.map[founderId]||{}).pinned)||null; var pinnedPost=null; if(pinKey){ var pp=pinKey.split(':'); var po=((C.feed.map[pp[0]]||{}).posts||[]).find(function(x){ return x.id===pp[1]; }); if(po) pinnedPost=Object.assign({uid:pp[0]}, po); }
  var evals = isFounder ? evalsColl.map : (evalsMine.data && me ? (function(){ var o={}; o[me]=evalsMine.data; return o; })() : {});
  var ctx={db:db, user:pf.user, mcp:pf.mcp, downloads:pf.downloads, permissions:pf.permissions, w:w, now:now, meId:me, meName:pf.me?pf.me.name:'', isFounder:isFounder, founderId:founderId, roster:rosterData, settings:settings, ids:ids.length?ids:(me?[me]:[]), prof:prof, nm:nm,
    keeperPath:keeperPath, finPath:finPath, statePath:statePath, keeper:keeper.data, finance:finance.data, state:stateDoc.data, evals:evals, hbIds:hbIds, pinnedPost:pinnedPost};
  Object.keys(C).forEach(function(k){ ctx[k]=C[k].map; });
  ctx.flags=useMemo(function(){ return me ? evaluateRules(ctx, now) : []; }, [now, me, C.checkin.map, C.eod.map, C.plan.map, C.review.map, C.tasks.map, C.pitches.map, C.projects.map, C.clients.map, C.candidates.map, C.acks.map, C.handbook.map, C.leave.map, C.leavedec.map, evals, settingsDoc.data, rosterData]);
  var ready=pf.mode==='ok' && roster.ready && settingsDoc.ready && (isFounder || (mem && mem.active!==false));
  var needs=ready?needsOf(ctx):[];
  var moodN=isFounder?needs.length:(ready?ctx.flags.filter(function(f){ return f.uid===me && f.sev!=='low'; }).length:0);
  useEffect(function(){ if(ready) MK.mood(moodN); });
  useEffect(function(){ if(!ready) return; var ev=liveEvents(ctx); var keys={}; ev.forEach(function(e){ keys[e.k]=1; });
    if(!seenEv.current){ seenEv.current=keys; return; }
    var fresh=ev.filter(function(e){ return !seenEv.current[e.k] && e.uid!==me && (e.at||0)>BOOT && (isFounder || e.cap==='feed' || (e.cap==='kudos' && e.to===me)); });
    seenEv.current=keys;
    fresh.slice(0,3).reverse().forEach(function(e){ ISL.notify(e.text, e.cap, function(){ if(CUR.go) CUR.go(e.go); }); }); });
  if(pf.mode==='loading') return html`<${Gate} title="Signing you in" text="Connecting to your Mask360 workspace." />`;
  if(pf.mode==='nohost') return html`<${Gate} title="Open this inside Claude" text="m360 OS runs at its claude.ai link. Sign in with your Mask360 Claude account and open the link you were sent." />`;
  if(pf.mode==='nocap') return html`<${Gate} title="Workspace unavailable" text="This view can't reach the Mask360 workspace. Reload, or open the link again from claude.ai." />`;
  if(pf.mode==='noid') return html`<${Gate} title="Sign in to continue" text="m360 OS needs your Mask360 Claude account. Sign in on claude.ai with your work account, then open the link again." />`;
  if(!roster.ready || !settingsDoc.ready) return html`<${Gate} title="Loading the workspace" text="One moment." />`;
  if(!isFounder && (!mem || mem.active===false)) return html`<${JoinGate} name=${first(pf.me.name)} founder=${(founderId&&prof[founderId]&&prof[founderId].name)||'Kaavish'} sent=${!!joinMine.data} onAsk=${function(){ w.set('joinreq/'+me, {at:Date.now()}, 'Request sent'); }} />`;
  var unreadHb=hbIds.filter(function(id){ return ((((C.acks.map[me]||{}).s)||{})[id]||0) < (C.handbook.map[id].updated||0); }).length;
  var pendLeave=0; if(isFounder){ Object.keys(C.leave.map).forEach(function(uid){ var d=((C.leavedec.map[uid]||{}).d)||{}; ((C.leave.map[uid]||{}).reqs||[]).forEach(function(r){ if(!d[r.id]) pendLeave++; }); }); }
  var myEvals=Object.keys(C.candidates.map).filter(function(cid){ var c=C.candidates.map[cid]; return c && !c.decision && (c.evaluators||[]).indexOf(me)>-1 && !((evals[me]||{}).e||{})[cid]; }).length;
  var parts=hash.split('/'); var page=parts[0]||(isFounder?'command':'today'); var sub=parts[1]||null;
  var NAV=[['today','Today',I.today,0,''],['tasks','My tasks',I.tasks,0,'work'],['projects','Projects',I.projects,0,'work'],['pitches','Pitches',I.pitches,0,'work'],['clients','Clients',I.brief,0,'work'],['feed','Feed',I.feed,0,'team'],['week','The week',I.week,0,'team'],['scores','Scores',I.scores,0,'team'],['people','People',I.people,0,'team'],['hiring','Hiring',I.hiring,myEvals,'team'],['handbook','Handbook',I.book,unreadHb,'team'],['voice','Voice',I.voice,0,'team'],['leave','Leave',I.leave,0,'team']];
  if(isFounder) NAV=[['command','Command',I.command,needs.length,'']].concat(NAV).concat([['desk','Desk',I.desk,pendLeave,'founder']]);
  var valid=NAV.map(function(n){ return n[0]; }); if(valid.indexOf(page)<0){ page=isFounder?'command':'today'; sub=null; }
  var TABS=isFounder?[['command','Command',I.command,needs.length],['today','Today',I.today,0],['tasks','Tasks',I.tasks,0],['week','Week',I.week,0]]:[['today','Today',I.today,0],['tasks','Tasks',I.tasks,0],['feed','Feed',I.feed,0],['week','Week',I.week,0]];
  var tabKeys=TABS.map(function(n){ return n[0]; }); var MORE=NAV.filter(function(n){ return tabKeys.indexOf(n[0])<0; });
  var go=function(k){ setHash(k); };
  var P={today:Today, tasks:Tasks, projects:Projects, pitches:Pitches, clients:Clients, feed:Feed, week:Week, scores:Scores, people:People, hiring:Hiring, handbook:Handbook, voice:Voice, leave:Leave, command:Command, desk:Desk};
  var Page=P[page]; var myTitle=(mem&&mem.title)||(isFounder?'Founder':'');
  var groups=[]; NAV.forEach(function(n){ var g=groups.find(function(x){ return x.g===n[4]; }); if(!g){ g={g:n[4], items:[]}; groups.push(g); } g.items.push(n); });
  CUR.ctx=ctx; CUR.go=go; CUR.page=page; CUR.hash=hash; CUR.nav=NAV;
  var label=(NAV.find(function(n){ return n[0]===page; })||[])[1]||'';
  return html`<div class="app">
    <${Side} groups=${groups} page=${page} go=${go} me=${pf.me} meId=${me} meName=${pf.me.name||'You'} sub=${[empIdOf(ctx,me), myTitle].filter(Boolean).join(', ')} sbx=${sbx} />
    <header class="pbar lg" id="pbar"><button class="pm" type="button" aria-label="m360, back to top" onClick=${function(){ MK.spin(); glide(0); }}><${LiveMark} /></button>
      <button class="where" type="button" aria-haspopup="dialog" aria-expanded=${menu?'true':'false'} onClick=${function(){ setMenu(true); }}><span>${label}</span>${I.chev}</button>
      <button class="mbtn" type="button" aria-label="Your profile" onClick=${function(){ go('people/'+me); }}><${Av} prof=${pf.me} size=${32} /></button></header>
    <main class="main" id="main"><${Page} key=${page+'/'+(sub||'')} ctx=${ctx} go=${go} id=${sub} /></main>
    <${TabBar} tabs=${TABS} page=${page} go=${go} moreOn=${MORE.some(function(n){ return n[0]===page; })} moreDot=${MORE.some(function(n){ return n[3]; })} onMore=${function(){ setMenu(true); }} />
    ${menu ? html`<${Menu} groups=${groups} page=${page} go=${go} onClose=${function(){ setMenu(false); }} />` : null}
  </div>`;
}
var root=ReactDOM.createRoot(document.getElementById('root')); root.render(html`<${App} />`);
