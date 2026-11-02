/* REACT reference (React 18 + htm): Command rebuilt in the v7 layout on live data.
   Uses the artifact's helpers; map each to this OS's data using the Command data contract. */
/* ---------------- Command ---------------- */
function NeedCard(p){
  var ref=useRef(null); var g=useState(false); var leaving=g[0], setLeaving=g[1];
  var okR=useRef(p.onOk), noR=useRef(p.onNo); okR.current=p.onOk; noR.current=p.onNo;
  function act(which){ setLeaving(true); setTimeout(function(){ var f=which>0?okR.current:noR.current; Promise.resolve(f?f():true).then(function(ok){ if(ok===false){ setLeaving(false); var c=ref.current&&ref.current.querySelector('.c-nc'); if(c) c.style.translate=''; if(ref.current) ref.current.classList.remove('sl','sr','arm'); } }); },320); }
  useEffect(function(){ if(!p.swipe||!ref.current) return; var c=ref.current.querySelector('.c-nc'); return bindSwipe(ref.current,c,function(dir){ act(dir); }); },[p.swipe]);
  return html`<div class=${cls('c-ncw', leaving&&'going')} ref=${ref} style=${{'--j':p.j}}>
    ${p.swipe?html`<div class="c-nsw c-nsw-l cap" aria-hidden="true">${p.okLabel}</div><div class="c-nsw c-nsw-r cap" aria-hidden="true">${p.noLabel}</div>`:null}
    <article class=${cls('c-nc', p.hot&&'hotz')}>
      <div class="c-nt"><span class="cap">${p.tag}</span><span class="cap">${p.when}</span></div>
      <div class="c-who">${p.who}</div>
      <div class="c-ndt">${p.detail}</div>
      <div class="c-acts"><button class="btn" type="button" onClick=${function(){ if(p.okNav) p.onOk(); else act(1); }}>${p.okLabel}</button>${p.noLabel?html`<button class="lnkb" type="button" onClick=${function(){ if(p.noNav) p.onNo(); else act(-1); }}>${p.noLabel}</button>`:null}</div>
    </article></div>`;
}
function CmdHead(p){ return html`<div class="c-sh"><span class="c-eb"><i>${p.n}</i>${p.t}</span>${p.children||null}</div>`; }
function vzBars(arr,dense){ return html`<div class=${cls('vb', (dense||arr.length>14)&&'dense')}>${arr.slice(0,40).map(function(c,i){ return html`<i key=${i} class=${c||null} style=${{'--j':i}}></i>`; })}</div>`; }
function Command(p){
  var ctx=p.ctx; var t=todayStr(); var nowD=new Date(ctx.now); var team=ctx.ids; var y=ymd(addDays(nowD,-1)); for(var bk=1; bk<=7; bk++){ var dd=ymd(addDays(nowD,-bk)); if(team.some(function(id){ return isWorkingDay(ctx,id,dd); })){ y=dd; break; } } var yLab=y===ymd(addDays(nowD,-1))?'eod yesterday':'eod '+WD[parseYmd(y).getDay()].toLowerCase(); var wk=weekId(nowD); var mon=mondayOf(nowD); var nm=nowMin();
  var rf=useState(''); var ruleF=rf[0], setRuleF=rf[1];
  var sf=useState('all'); var sevF=sf[0], setSevF=sf[1];
  var fa=useState(false); var allF=fa[0], setAllF=fa[1];
  var af=useState(PEND.att||'all'); var attF=af[0], setAttF=af[1];
  var root=useRef(null), tkr=useRef(null);
  useEffect(function(){ PEND.att=null; var f=function(v){ setAttF(v||'all'); }; EVB.on('att',f); RV.scan(root.current); CMDP.mount(); return function(){ EVB.off('att',f); CMDP.unmount(); }; },[]);
  var st=ctx.settings; var lim=minutesOf(st.start||'10:30')+(st.grace||0);
  var working=team.filter(function(id){ return isWorkingDay(ctx,id,t); });
  var inToday=working.filter(function(id){ return checkinOf(ctx,id,t); });
  var notIn=working.filter(function(id){ return !checkinOf(ctx,id,t); });
  var late=inToday.filter(function(id){ return lateMins(ctx,id,checkinOf(ctx,id,t))>0; });
  var office=inToday.filter(function(id){ return checkinOf(ctx,id,t).mode==='office'; }); var verified=office.filter(function(id){ var l=checkinOf(ctx,id,t).loc; return l&&l.verified; });
  var yWorking=team.filter(function(id){ return isWorkingDay(ctx,id,y); }); var yEod=yWorking.filter(function(id){ return eodOf(ctx,id,y); });
  var marks=[]; team.forEach(function(id){ var plan=((((ctx.plan[id]||{}).weeks)||{})[wk]||{}).items||[]; var rv=((((ctx.review[id]||{}).weeks)||{})[wk]||{}).marks||{}; plan.forEach(function(it){ marks.push(rv[it.id]==='hit'?'':rv[it.id]==='miss'?'f':'g'); }); });
  var hit=marks.filter(function(m){ return m===''; }).length, missed=marks.filter(function(m){ return m==='f'; }).length;
  var overdueT=tasksOf(ctx).filter(function(x){ return x.status!=='done' && x.due && x.due<t; });
  var flagsAll=ctx.flags; var high=flagsAll.filter(function(f){ return f.sev==='high'; }).length;
  var PIPE=ansPipe(ctx); var L=ansLargest(ctx); var largest=L.tot?Math.round(100*L.rows[0][1]/L.tot):null; var E=ansEnergy(ctx);
  var needs=needsOf(ctx); var nmY=function(id){ return id===ctx.meId?'You':ctx.nm(id); };
  var hr=nowD.getHours(); var greet=(hr<5?'Up late':hr<12?'Good morning':hr<17?'Good afternoon':'Good evening')+', '+first(ctx.meName)+'.';
  var evs=liveEvents(ctx).filter(function(e){ return (e.at||0)>Date.now()-24*3600000; }).slice(0,6).map(function(e){ return e.text; });
  useEffect(function(){ CMDP.ticker(tkr.current, evs); });

  /* needs you */
  function decide(r,status){ var cur=clone(ctx.leavedec[r.uid])||{d:{}}; cur.d=cur.d||{}; cur.d[r.id]={status:status, at:Date.now()}; cur.d=pruneKeys(cur.d,120);
    return ctx.w.set('leavedec/'+r.uid, cur).then(function(ok){ if(ok) ISL.confirm((status==='approved'?'Approved, ':'Declined, ')+ctx.nm(r.uid), leaveRange(r), function(){ var c2=clone(CUR.ctx.leavedec[r.uid])||{d:{}}; if(c2.d) delete c2.d[r.id]; CUR.ctx.w.set('leavedec/'+r.uid, c2, 'Back in your queue'); }); return ok; }); }
  function dismissJoin(uid){ var at=(ctx.joinreq[uid]||{}).at||Date.now(); return ctx.w.del('joinreq/'+uid).then(function(ok){ if(ok) ISL.confirm('Dismissed, '+ctx.nm(uid), 'join request', function(){ CUR.ctx.w.set('joinreq/'+uid, {at:at}, 'Back in your queue'); }); return ok; }); }
  var shown=needs.slice(0,8);
  var needCards=shown.map(function(n,i){
    if(n.kind==='leave'){ var r=Object.assign({uid:n.uid}, n.r); var days=daysBetween(r.from,r.to)+1; var ty=(LTYPES.find(function(x){ return x[0]===r.type; })||['',''])[1];
      return html`<${NeedCard} key=${n.k} j=${i} swipe=${true} tag="leave" when=${'asked '+ago(r.at||Date.now())} who=${html`<button type="button" onClick=${function(){ p.go('people/'+n.uid); }}>${ctx.nm(n.uid)}</button>`} detail=${leaveRange(r)+', '+plural(days,'day')+(ty?', '+ty.toLowerCase():'')} okLabel="Approve" noLabel="Decline" onOk=${function(){ return decide(r,'approved'); }} onNo=${function(){ return decide(r,'declined'); }} />`; }
    if(n.kind==='join') return html`<${NeedCard} key=${n.k} j=${i} tag="join" when=${'asked '+ago(n.at||Date.now())} who=${ctx.nm(n.uid)} detail="Wants in on the OS. Add a title and pod on the Desk." okLabel="Add" noLabel="Dismiss" okNav=${true} onOk=${function(){ p.go('desk'); }} onNo=${function(){ return dismissJoin(n.uid); }} />`;
    if(n.kind==='decide') return html`<${NeedCard} key=${n.k} j=${i} tag="hire" when="panel done" who=${n.c.name||'Candidate'} detail=${(n.c.role||'')+', '+n.n+' of '+(n.c.evaluators||[]).length+' reads in'} okLabel="Decide" okNav=${true} onOk=${function(){ p.go('hiring/'+n.cid); }} />`;
    if(n.kind==='eval') return html`<${NeedCard} key=${n.k} j=${i} tag="evaluate" when=${n.c.deadline?'by '+fmtDay(n.c.deadline):'panel'} who=${n.c.name||'Candidate'} detail=${(n.c.role||'')+', your read is due'} okLabel="Evaluate" okNav=${true} onOk=${function(){ p.go('hiring/'+n.cid); }} />`;
    var f=n.f; return html`<${NeedCard} key=${n.k} j=${i} hot=${true} tag="flag" when="high" who=${html`<button type="button" onClick=${function(){ p.go(f.uid===ctx.meId?'today':'people/'+f.uid); }}>${nmY(f.uid)}</button>`} detail=${f.name+'. '+f.text} okLabel="Open" noLabel="Rule" okNav=${true} noNav=${true} onOk=${function(){ p.go(flagGo(f)); }} onNo=${function(){ p.go('handbook/'+f.section); }} />`;
  });

  /* numbers */
  var T0v=minutesOf(st.start||'10:30')-60, T1v=T0v+180; var vpos=function(m){ return clampN((m-T0v)/(T1v-T0v)*100,0,100).toFixed(2)+'%'; };
  var lateViz=html`<div class="vt">${[html`<i key="t0" class="t0" style=${{left:vpos(minutesOf(st.start||'10:30'))}}></i>`].concat(inToday.slice(0,30).map(function(id,i){ var c=checkinOf(ctx,id,t); return html`<i key=${id} class=${cls('d', lateMins(ctx,id,c)>0&&'f')} style=${{left:vpos(tsMin(c.in)),'--j':i}}></i>`; }))}</div>`;
  var verPct=office.length?Math.round(100*verified.length/office.length):null;
  var eFull=E.e!=null?Math.floor(E.e):0, eFrac=E.e!=null?E.e-eFull:0;
  var energyViz=html`<div class="ve">${[0,1,2,3,4].map(function(i){ var bg=i<eFull?null:(i===eFull&&eFrac>0?{background:'linear-gradient(to top,var(--ink) '+Math.round(eFrac*100)+'%,var(--g12) '+Math.round(eFrac*100)+'%)'}:null); return html`<i key=${i} class=${i<eFull||(i===eFull&&eFrac>0)?null:'g'} style=${Object.assign({'--j':i},bg||{})}></i>`; })}</div>`;
  var stOpen=['lead','qualified','diagnostic','proposal','negotiation']; var stW={}, stN={}; stOpen.forEach(function(s){ stW[s]=0; stN[s]=0; });
  Object.keys(ctx.pitches).forEach(function(k){ var x=ctx.pitches[k]; if(stW[x.stage]==null) return; stW[x.stage]+=pitchValue(ctx,k).weighted; stN[x.stage]++; });
  var pipeViz=html`<div class="vs">${PIPE.w?stOpen.filter(function(s){ return stW[s]>0; }).map(function(s,i){ return html`<i key=${s} style=${{width:(100*stW[s]/PIPE.w).toFixed(2)+'%','--a':(.3+.7*(STAGE_PROB[s]||10)/75).toFixed(2),'--j':i}}></i>`; }):html`<i style=${{width:'100%','--a':.12}}></i>`}</div>`;
  var meter=function(pct,hotM,mark){ return html`<div class="vm">${mark?html`<i class="mk25" style=${{left:'25%'}}></i><span class="vml" style=${{left:'calc(25% + 6px)'}}>25%</span>`:null}<i class=${cls('fill', hotM&&'f')} style=${{width:clampN(pct||0,0,100)+'%'}}></i></div>`; };
  var num=function(v,o){ return html`<span class=${cls('c-num', o&&o.long&&'long', o&&o.word&&'word')} style=${{'--i':o&&o.i||0}}>${v}</span>`; };
  var after=nm>lim;
  var T=[
    ['people',{k:'in',l:'in today',v:num(html`${inToday.length}<span>/${working.length}</span>`,{i:0}),viz:vzBars(working.map(function(id){ return checkinOf(ctx,id,t)?'':'g'; })),c:notIn.length?(after?'Not in: ':'Still to come: ')+names(notIn.map(nmY)):(working.length?'Everyone is in':'Nobody working today'),hot:after&&notIn.length>0,go:function(){ showAt('command','#c-att .c-tr.rw',{att:notIn.length?'none':'all'}); }}],
    ['people',{k:'late',l:'late today',v:num(late.length,{i:1}),viz:lateViz,c:late.length?names(late.map(ctx.nm)):'Nobody late',hot:late.length>0,go:function(){ showAt('command','#c-att .c-tr.rw',{att:late.length?'late':'all'}); }}],
    ['people',{k:'ver',l:'office verified',v:verPct!=null?num(html`${verPct}<span>%</span>`,{i:2}):num('none yet',{i:2,word:1}),viz:meter(verPct||0,false),c:office.length?verified.length+' of '+office.length+' office check-ins':'No office check-ins yet',hot:false,go:function(){ showAt('command','#c-att .c-tr.rw',{att:'office'}); }}],
    ['people',{k:'eod',l:yLab,v:num(html`${yEod.length}<span>/${yWorking.length}</span>`,{i:3}),viz:vzBars(yWorking.map(function(id){ return eodOf(ctx,id,y)?'':'g'; })),c:yWorking.length&&yEod.length<yWorking.length?'Missing: '+names(yWorking.filter(function(id){ return !eodOf(ctx,id,y); }).map(nmY)):(yWorking.length?'Everyone posted':'Nobody worked yesterday'),hot:false,go:function(){ p.go('week'); }}],
    ['mood',{k:'mood',l:'team energy',v:E.e!=null?num(html`${E.e.toFixed(1)}<span>/5</span>`,{i:4}):num('none yet',{i:4,word:1}),viz:energyViz,c:E.e!=null?'Week '+weekNum(E.lw)+', '+plural(E.n,'reply','replies'):'No pulse yet',hot:E.e!=null&&E.e<3,go:function(){ showAt('command','#c-vox'); }}],
    ['work',{k:'out',l:'outcomes hit',v:num(html`${hit}<span>/${marks.length}</span>`,{i:5}),viz:vzBars(marks),c:marks.length?'This week'+(missed?', '+missed+' missed':''):'No outcomes posted yet',hot:false,go:function(){ p.go('week'); }}],
    ['work',{k:'due',l:'tasks overdue',v:num(overdueT.length,{i:6}),viz:vzBars(overdueT.map(function(x){ return daysBetween(x.due,t)>3?'f':''; }),true),c:overdueT.length?'Across the team':'Nothing overdue',hot:overdueT.length>0,go:function(){ p.go('tasks'); }}],
    ['work',{k:'hf',l:'high flags',v:num(high,{i:7}),viz:vzBars(flagsAll.map(function(f){ return f.sev==='high'?'f':f.sev==='medium'?'':'s'; }),true),c:plural(flagsAll.length,'flag')+' in total',hot:high>0,go:function(){ showAt('command','#c-flg'); }}],
    ['money',{k:'pipe',l:'weighted pipeline',v:num(inr(PIPE.w),{i:8,long:1}),viz:pipeViz,c:'A month, '+plural(PIPE.n,'open pitch','open pitches'),hot:false,go:function(){ showAt('command','#c-pipe'); }}],
    ['money',{k:'cl',l:'largest client',v:largest!=null?num(html`${largest}<span>%</span>`,{i:9}):num('none yet',{i:9,word:1}),viz:meter(largest||0,largest!=null&&largest>25,true),c:largest!=null?(ctx.clients[L.rows[0][0]].name||'Client')+', share of revenue':'No revenue set',hot:largest!=null&&largest>25,go:function(){ showAt('command',largest!=null?'#c-cli [data-id="'+L.rows[0][0]+'"]':'#c-cli'); }}]
  ];
  var GL={people:'people',mood:'mood',work:'work',money:'money'}; var seenG={};
  var tile=function(g,o){ var firstOf=!seenG[g]; seenG[g]=1; return html`<button type="button" key=${o.k} class=${cls('c-kp', o.hot&&'hot hotz')} onClick=${o.go}>${firstOf?html`<i class="c-kgl">${GL[g]}</i>`:null}<span class="c-kl"><span class="cap">${o.l}</span><i class="go"></i></span><span class="c-kvb">${o.v}</span><span class="c-viz">${o.viz}</span><span class="c-kn">${o.c}</span></button>`; };

  /* attendance */
  var STS=minutesOf(st.start||'10:30'); var A0=Math.floor((STS-60)/60)*60; var A1=Math.max(A0+240, Math.min(1440, Math.ceil((nm+30)/60)*60)); if(A1-A0>720) A0=A1-720;
  var apos=function(m){ return clampN((m-A0)/(A1-A0)*100,0,100); };
  var attRows=team.map(function(id){ var ci=checkinOf(ctx,id,t); var s=statusOf(ctx,id,t); var lm=ci?lateMins(ctx,id,ci):0; var wkd=isWorkingDay(ctx,id,t);
    var f=['all']; if(ci){ f.push(ci.mode==='wfh'?'wfh':'office'); if(lm) f.push('late'); } else if(s==='leave'||s==='holiday') f.push('leave'); else if(wkd) f.push('none');
    return {id:id, ci:ci, s:s, lm:lm, f:f, wkd:wkd}; });
  var cnt=function(k){ return attRows.filter(function(r){ return r.f.indexOf(k)>-1; }).length; };
  var chips=[['all','All'],['office','Office'],['wfh','WFH'],['late','Late'],['none','Not in'],['leave','Leave']];
  var labs=[[A0,pad(Math.floor(A0/60))+':00',''],[STS,'start '+(st.start||'10:30'),'']].concat(nm>=A0&&nm<=A1?[[nm,'now','al']]:[]).concat([[A1,pad(Math.floor(A1/60)%24)+':00','']]);
  labs.sort(function(a,b){ return a[0]-b[0]; }); var keep=[];
  labs.forEach(function(lb){ var prev=keep[keep.length-1]; if(!prev || apos(lb[0])-apos(prev[0])>=11){ keep.push(lb); return; } if(lb[2]==='al') keep[keep.length-1]=lb; });
  var dayCell=function(r,i){ var out=[html`<i key="g" class="g10" style=${{left:apos(STS)+'%'}}></i>`]; if(nm>=A0&&nm<=A1) out.push(html`<i key="n" class="gn" style=${{left:apos(nm)+'%'}}></i>`);
    if(r.ci){ var a=tsMin(r.ci.in), b=r.ci.out?tsMin(r.ci.out):nm; out.push(html`<i key="b" class=${cls('b', !r.ci.out&&'live')} style=${{left:apos(a)+'%',width:Math.max(.6,apos(b)-apos(a))+'%','--j':i}}></i>`); out.push(html`<i key="o" class="ot" style=${{left:apos(a)+'%'}}>in ${hm(r.ci.in)}${r.ci.out?', out '+hm(r.ci.out):''}</i>`); if(r.lm) out.push(html`<i key="l" class="lt" style=${{left:apos(a)+'%'}}></i>`); }
    else if(r.wkd && r.s==='none' && nm>lim) out.push(html`<i key="d" class="nd" style=${{left:apos(Math.min(nm,A1))+'%'}}></i>`);
    return html`<span class="c-day c-dayc">${out}</span>`; };
  var rowsShown=attRows.filter(function(r){ return r.f.indexOf(attF)>-1; });

  /* flags */
  var fl=flagsAll.filter(function(f){ return (!ruleF||f.rule===ruleF) && (sevF==='all'||f.sev===sevF); });
  var sevN=function(s){ return flagsAll.filter(function(f){ return (!ruleF||f.rule===ruleF) && (s==='all'||f.sev===s); }).length; };

  /* business */
  var lb=rankAll(ctx,'week',ctx.now).rows.slice(0,5); var lbMax=Math.max(1, lb.length?Math.max.apply(null, lb.map(function(r){ return Math.max(0,r.total); })):1);
  var stMax=Math.max.apply(null, stOpen.map(function(s){ return PIPE.w?stW[s]:stN[s]; }).concat([1]));
  var nextOver=Object.keys(ctx.pitches).filter(function(k){ var x=ctx.pitches[k]; return x.nextDate&&x.nextDate<t&&x.stage!=='won'&&x.stage!=='lost'; }).length;
  var projs=Object.keys(ctx.projects).filter(function(k){ var x=ctx.projects[k]; return !x.archived && x.status!=='done'; }); var ph={on:0,risk:0,off:0}; projs.forEach(function(k){ var s=ctx.projects[k].status||'on'; ph[s]=(ph[s]||0)+1; });
  var shaky=projs.filter(function(k){ return (ctx.projects[k].status||'on')!=='on'; }).sort(function(a,b){ return (ctx.projects[a].status==='off'?0:1)-(ctx.projects[b].status==='off'?0:1); });

  /* team */
  var mid=monthId(nowD); var keeperNotes=((ctx.keeper||{}).notes)||{};
  var crew=team.filter(function(id){ return id!==ctx.founderId; });
  var cands=Object.keys(ctx.candidates).filter(function(k){ return !ctx.candidates[k].decision && ctx.candidates[k].stage!=='hired' && ctx.candidates[k].stage!=='rejected'; });
  var pulses=Object.keys(ctx.pulse).map(function(k){ return ctx.pulse[k]; }).sort(function(a,b){ return (b.at||0)-(a.at||0); }).filter(function(x){ return x.change||x.broken||x.working; }).slice(0,2);

  /* clients */
  var fin=((ctx.finance||{}).clients)||{}; var cids=Object.keys(ctx.clients).sort(function(a,b){ return ((fin[b]||{}).monthly||0)-((fin[a]||{}).monthly||0) || String(ctx.clients[a].name).localeCompare(String(ctx.clients[b].name)); });
  var openOf=function(k){ return tasksOf(ctx).filter(function(x){ return x.client===k&&x.status!=='done'; }).length; };

  return html`<div class="page cmd" ref=${root}>
    <header class="c-top">
      <div class="c-tl">
        <div class="lab">${fmtLong(nowD).toLowerCase()}, week ${weekNum(wk)}</div>
        <h1>Command</h1>
        <p class="c-lede"><span>${greet}</span>${needs.length?html`<button type="button" class="c-needl" onClick=${function(){ showAt('command','#c-need .c-nc'); }}><b>${plural(needs.length,'thing needs you','things need you')}</b><i class="ar"></i></button>`:html`<span class="c-needl ok">All clear.</span>`}</p>
      </div>
      <div class="c-tr2">
        <button type="button" class="c-askf" onClick=${function(e){ ISL.cmd('', e.currentTarget.getBoundingClientRect()); }}>${I.search}<span class="phd">Ask m360 or jump to anything</span><kbd class="kb">⌘K</kbd></button>
        <div class="c-live"><span class="chip cap"><i></i>live</span><div class="c-tkr" ref=${tkr} aria-live="polite" dangerouslySetInnerHTML=${{__html:''}}></div></div>
      </div>
    </header>

    <section class="c-sec" id="c-need">
      <${CmdHead} n="01" t="needs you">${needs.length?html`<span class="c-pl">${needs.length} open</span>`:null}<//>
      ${needs.length?html`<div class="c-ngrid">${needCards}</div>${needs.length>shown.length?html`<p class="c-more">And ${needs.length-shown.length} more in the flags below.</p>`:null}`
        :html`<div class="c-clear"><span class="ok">${I.check}</span><div><b>All clear.</b><p>Nothing needs you right now. Approvals and high flags land here.</p></div></div>`}
    </section>

    <section class="c-sec rv" id="c-nums">
      <${CmdHead} n="02" t="numbers"><button type="button" class="c-pl" onClick=${function(){ p.go('week'); }}>The week</button><//>
      <div class="c-kpis">
        <div class="c-kg" style=${{gridColumn:'span 4'}}>people</div><div class="c-kg">mood</div>
        ${T.slice(0,5).map(function(x){ return tile(x[0],x[1]); })}
        <div class="c-kg k2" style=${{gridColumn:'span 3'}}>work</div><div class="c-kg k2" style=${{gridColumn:'span 2'}}>money</div>
        ${T.slice(5).map(function(x){ return tile(x[0],x[1]); })}
      </div>
    </section>

    <section class="c-band warm rv" id="c-att">
      <div class="stack" style=${{gap:'24px'}}>
        <div class="card">
          <${CmdHead} n="03" t="attendance today"><button type="button" class="c-pl" onClick=${function(){ p.go('desk'); }}>Export</button><//>
          <div class="c-fcs" role="tablist">${chips.map(function(c){ var n=cnt(c[0]); var al=(c[0]==='late'&&n>0)||(c[0]==='none'&&n>0&&after); return html`<button key=${c[0]} type="button" class=${cls('c-fc', attF===c[0]&&'on')} onClick=${function(){ setAttF(c[0]); }}>${c[1]}<b class=${al?'al':null}>${n}</b></button>`; })}</div>
          <div class="c-atb">
            <div class="c-tr hd"><span class="c-id">id</span><span>person</span><span>status</span><span class="c-place">place</span><span>in</span><span class="c-dh c-dayc">${keep.map(function(lb){ return html`<i key=${lb[1]} class=${lb[2]||null} style=${{left:apos(lb[0])+'%'}}>${lb[1]}</i>`; })}</span></div>
            ${rowsShown.length?rowsShown.map(function(r,i){ var l=r.ci&&r.ci.loc;
              return html`<div class="c-tr rw c-lk c-fresh" key=${r.id} role="button" tabIndex="0" onClick=${function(){ p.go('people/'+r.id); }} onKeyDown=${function(e){ if(e.key==='Enter') p.go('people/'+r.id); }}>
                <span class="c-id mut sm tn">${empIdOf(ctx,r.id)}</span>
                <span class="c-person"><${Av} prof=${ctx.prof[r.id]} size=${24} /><span class="c-nm">${ctx.nm(r.id)}</span></span>
                <span class=${r.s==='none'&&r.wkd&&after?'flt':null}>${r.s==='none'&&!r.wkd?'Off today':STATUS_LABEL[r.s]}</span>
                <span class="c-pl2 c-place">${l?html`<span>${l.place}</span>${l.lat!=null&&!l.verified?html`<a class="lnk sm" href=${'https://www.google.com/maps?q='+l.lat+','+l.lng} target="_blank" rel="noopener noreferrer" onClick=${function(e){ e.stopPropagation(); }}>Map</a>`:null}${l.verified?null:html`<span class="c-vf">unverified</span>`}`:html`<span class="soft">${r.ci?'No location':''}</span>`}</span>
                <span class=${cls('tn', r.lm&&'flt')}>${r.ci?hm(r.ci.in):''}</span>
                ${dayCell(r,i)}<i class="go"></i></div>`; }):html`<p class="c-empty">Nobody here.<small>Try another filter.</small></p>`}
          </div>
        </div>
        <div class="card" id="c-flg">
          <${CmdHead} n="04" t="flags"><select class="sel mini" value=${ruleF} onChange=${function(ev){ setRuleF(ev.target.value); }} aria-label="Filter by rule"><option value="">All rules</option>${RULE_IDS.map(function(r){ return html`<option key=${r} value=${r}>${r} ${RULE_NAMES[r]}</option>`; })}</select><//>
          <div class="c-fcs">${[['all','All'],['high','High'],['medium','Medium'],['low','Low']].map(function(c){ var n=sevN(c[0]); return html`<button key=${c[0]} type="button" class=${cls('c-fc', sevF===c[0]&&'on')} onClick=${function(){ setSevF(c[0]); }}>${c[1]}<b class=${c[0]==='high'&&n>0?'al':null}>${n}</b></button>`; })}</div>
          ${fl.length?html`<div class="c-fls">${fl.slice(0,allF?60:8).map(function(f,i){ return html`<button type="button" class="c-fl c-hl c-lk" key=${f.rule+f.uid+i} onClick=${function(){ p.go(flagGo(f)); }}><span class=${cls('sev', f.sev)}></span><span><b><span class="c-nm">${nmY(f.uid)}</span>, ${f.name}</b><p>${f.text}</p></span><i class="go"></i></button>`; })}</div>${fl.length>8?html`<div class="c-fcs"><button type="button" class="c-pl" onClick=${function(){ setAllF(!allF); }}>${allF?'Show fewer':'Show all '+fl.length}</button></div>`:null}`
            :html`<p class="c-empty">All clear.<small>${flagsAll.length?'Nothing at this filter.':'The rules are quiet.'}</small></p>`}
        </div>
      </div>
    </section>

    <section class="c-band dark rv" id="c-biz">
      <div class="c-g543">
        <div id="c-lb">
          <${CmdHead} n="05" t="leaderboard, this week"><button type="button" class="c-pl" onClick=${function(){ p.go('scores'); }}>Scores</button><//>
          ${lb.length?lb.map(function(r,i){ return html`<button type="button" class=${cls('c-lbr c-hl c-lk', i===0&&'first')} key=${r.uid} onClick=${function(){ p.go('people/'+r.uid); }}><span class="rk dsoft">${i+1}</span><span class="whom"><span class="c-nm">${ctx.nm(r.uid)}</span><span class="ln" style=${{'--w':Math.max(4,Math.round(100*Math.max(0,r.total)/lbMax))+'%'}}></span></span><span class="c-pts">${r.total}</span><i class="go"></i></button>`; })
            :html`<p class="c-empty">No scores yet.<small>${crew.length?'Points land as the week moves.':'Add your team from the Desk to start the board.'}</small></p>`}
        </div>
        <div id="c-pipe">
          <${CmdHead} n="06" t="pipeline"><button type="button" class="c-pl" onClick=${function(){ p.go('pitches'); }}>Open</button><//>
          <div class="c-pls"><div class="v" data-n=${Math.round(PIPE.w)} data-fmt="inr" data-v=${inr(PIPE.w)}>${inr(PIPE.w)}</div><div class="cap">weighted, a month, ${plural(PIPE.n,'open pitch','open pitches')}</div></div>
          ${stOpen.map(function(s,i){ var w=PIPE.w?stW[s]:stN[s]; return html`<button type="button" class="c-ppr c-hl c-lk" key=${s} onClick=${function(){ p.go('pitches'); }}><span class="c-ppt"><span class="c-nm">${STAGE_LABEL[s]}</span><b>${stN[s]}${stW[s]?', '+inr(stW[s]):''}</b></span><span class="c-ppb"><i style=${{'--w':(stMax?Math.round(100*w/stMax):0)+'%','--a':(.3+.7*(STAGE_PROB[s]||10)/75).toFixed(2),'--j':i}}></i></span><i class="go"></i></button>`; })}
          <div class="c-kvr"><span class="dsoft">Next steps overdue</span><b class=${nextOver?'flt':null}>${nextOver}</b></div>
        </div>
        <div id="c-proj">
          <${CmdHead} n="07" t="projects"><button type="button" class="c-pl" onClick=${function(){ p.go('projects'); }}>Open</button><//>
          <div class="c-pjs"><div><div class="v" data-n=${ph.on} data-v=${String(ph.on)}>${ph.on}</div><div class="cap">on track</div></div><div><div class="v" data-n=${ph.risk} data-v=${String(ph.risk)}>${ph.risk}</div><div class="cap">${ph.risk?html`<i class="adot"></i>`:null}at risk</div></div><div><div class="v" data-n=${ph.off} data-v=${String(ph.off)}>${ph.off}</div><div class="cap">${ph.off?html`<i class="adot"></i>`:null}off track</div></div></div>
          ${shaky.length?shaky.slice(0,5).map(function(k){ var x=ctx.projects[k]; var pg=projProgress(ctx,k); var off=x.status==='off'; return html`<button type="button" class="c-pjr c-hl c-lk" key=${k} onClick=${function(){ p.go('projects/'+k); }}><span class="c-pjt"><span class="grow c-nm">${x.name}</span><b class="tn">${pg.pct}%</b></span><span class="c-pjb"><i class=${off?'off':null} style=${{'--p':pg.pct+'%'}}></i></span><span class=${cls('c-pst', off?'flt':'dsoft')}>${off?'Off track':'At risk'}${x.due?', due '+fmtDay(x.due):''}</span><i class="go"></i></button>`; })
            :html`<p class="c-empty">${projs.length?'Every live project is on track.':'No live projects.'}</p>`}
        </div>
      </div>
    </section>

    <section class="c-sec rv" id="c-team">
      <div class="c-g444">
        <div>
          <${CmdHead} n="08" t="people"><button type="button" class="c-pl" onClick=${function(){ p.go('desk'); }}>Desk</button><//>
          ${crew.length?crew.slice(0,12).map(function(id){ var mi=missesLast30(ctx,id); var lv=Math.min(3,mi); var kd=(keeperNotes[id]||{})[mid]; var m=memberOf(ctx,id); var ob=m.joined&&daysBetween(m.joined,t)<=45?onboardState(ctx,id):null; var off=(ctx.access[id]||{}).offboard;
              return html`<button type="button" class="c-per c-hl c-lk" key=${id} onClick=${function(){ p.go('people/'+id); }}><span class="c-person"><${Av} prof=${ctx.prof[id]} size=${24} /><span class="c-nm">${ctx.nm(id)}</span></span><span class="c-tags"><span class=${lv>=2?'al':lv===1?'k':null}>${LADDER[lv].toLowerCase()}</span>, ${kd&&kd.fight&&kd.rehire?html`<span class="k">keeper done</span>`:'keeper due'}${ob?', onboarding '+ob.pct+'%':''}${off?html`, <span class="al">offboarding</span>`:null}</span><i class="go"></i></button>`; })
            :html`<p class="c-empty">Just you so far.<small>Add your team from the Desk and they show up here.</small></p>`}
        </div>
        <div id="c-hire">
          <${CmdHead} n="09" t="hiring"><button type="button" class="c-pl" onClick=${function(){ p.go('hiring'); }}>Open</button><//>
          ${cands.length?cands.slice(0,6).map(function(k){ var c=ctx.candidates[k]; var n=Object.keys(evalsFor(ctx,k)).length; var of=(c.evaluators||[]).length; return html`<button type="button" class="c-hir c-hl c-lk" key=${k} onClick=${function(){ p.go('hiring/'+k); }}><span><span class="c-nm">${c.name}</span><span class="c-sub">${c.role}</span></span><span class="c-ev"><span class="c-ticks">${Array.from({length:Math.max(of,1)}).map(function(_,i){ return html`<i key=${i} class=${i<n?'on':null}></i>`; })}</span><span class="sm">${n}/${of}</span></span><i class="go"></i></button>`; })
            :html`<p class="c-empty">Nobody in the panel.<small>New candidates get an independent read here.</small></p>`}
        </div>
        <div id="c-vox">
          <${CmdHead} n="10" t="voice"><button type="button" class="c-pl" onClick=${function(){ p.go('voice'); }}>Open</button><//>
          ${pulses.length?pulses.map(function(x,i){ return html`<div class="c-q c-hl" key=${i}><blockquote>${x.change||x.broken||x.working}</blockquote><div class="c-sub">Energy ${x.energy} of 5, week ${weekNum(x.week)}, anonymous</div></div>`; })
            :html`<p class="c-empty">No pulse yet.<small>The team answers one pulse a week, anonymously.</small></p>`}
        </div>
      </div>
    </section>

    <section class="c-sec rv" id="c-cli">
      <${CmdHead} n="11" t="clients"><button type="button" class="c-pl" onClick=${function(){ p.go('clients'); }}>Open</button><//>
      <div class="c-share">${L.tot?cids.filter(function(k){ return (fin[k]||{}).monthly; }).map(function(k,i){ var v=(fin[k]||{}).monthly||0; var pc=100*v/L.tot; return html`<i key=${k} title=${ctx.clients[k].name} style=${{width:pc.toFixed(2)+'%',background:i===0&&pc>25?'var(--flame)':'rgba(14,14,14,'+Math.max(.18,.9-i*.16).toFixed(2)+')'}}></i>`; }):html`<i style=${{width:'100%',background:'var(--g12)'}}></i>`}</div>
      ${cids.length?html`<div class="c-ct hd"><span>client</span><span class="c-own">owner</span><span class="c-open">open</span><span class="c-brain">brain</span><span>revenue</span></div>
        ${cids.map(function(k){ var c=ctx.clients[k]; var rev=(fin[k]||{}).monthly||0; var comp=['memory','approvals','never'].filter(function(f){ return c[f]; }).length; var o=openOf(k);
          return html`<div class="c-ct rw c-lk" key=${k} data-id=${k} role="button" tabIndex="0" onClick=${function(){ openReq('clients',k); }} onKeyDown=${function(e){ if(e.key==='Enter') openReq('clients',k); }}><span><span class="c-nm">${c.name}</span>${c.status&&c.status!=='live'?html` <span class="soft sm">${c.status}</span>`:null}</span><span class="c-own mut">${c.owner?ctx.nm(c.owner):'No owner'}</span><span class="c-open tn">${o}</span><span class="c-brain"><span class="c-dots">${[0,1,2].map(function(i){ return html`<i key=${i} class=${i<comp?'on':null}></i>`; })}</span></span><span>${rev?html`<span class="rvn">${inr(rev)}</span> <span class="soft sm">${Math.round(100*rev/L.tot)}%</span>`:html`<span class="soft">No revenue set</span>`}</span><i class="go"></i></div>`; })}
        ${L.tot?html`<div class="c-ct tot"><span>Total</span><span class="c-own"></span><span class="c-open tn">${cids.reduce(function(s,k){ return s+openOf(k); },0)}</span><span class="c-brain"></span><span><span class="rvn">${inr(L.tot)}</span> a month</span></div>`:null}`
        :html`<p class="c-empty">No clients yet.<small>Add the first one on Clients.</small></p>`}
    </section>

    <nav class="c-rail" id="c-rail" aria-label="Sections"><span class="c-rtr"><i></i></span>${CMDP.sec.map(function(s,i){ return html`<button key=${s[0]} type="button" class="c-ri" style=${{'--k':i}} aria-label=${s[1]} onClick=${function(){ CMDP.go(i); }}><span class="c-rl">${s[1]}</span></button>`; })}</nav>
  </div>`;
}
