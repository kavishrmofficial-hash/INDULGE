/* chrome.js, the interaction layer of the m360 v7 design.
   Framework free except LiveMark and useOpenReq (marked REACT). Needs, from the app:
   CUR.ctx (live data), CUR.go(route), CUR.page, CUR.hash, CUR.nav (pages as [key,label,icon,badge,group]).
   Pieces: MK the live mark, glide/flash/showAt, ISL the island (toast, confirm with UNDO, notify, Ask bar, voice),
   SB sidebar motion, TB tab bar lens, RV reveal and count up, FX scroll frame, CMDP Command rail and live line, bindSwipe. */
/* ---------------- chrome: live mark, island, ask bar, sidebar motion ---------------- */
var RM = (function(){ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(err){ return false; } })();
function $q(s,r){ return (r||document).querySelector(s); }
function $qa(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
function clampN(v,a,b){ return Math.max(a,Math.min(b,v)); }
function pnow(){ return (window.performance&&performance.now)?performance.now():Date.now(); }
function phone(){ return innerWidth<=900; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function ini(n){ var w=String(n||'').trim().split(/\s+/).filter(Boolean); if(!w.length) return ''; return (w[0][0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase(); }
function names(arr){ var a=arr.filter(Boolean); if(a.length<=2) return a.join(' and '); return a.slice(0,-1).join(', ')+' and '+a[a.length-1]; }
function plural(n,one,many){ return n+' '+(n===1?one:(many||one+'s')); }
var CUR={ctx:null, go:null, page:'', hash:''};
var PEND={att:null};
var BOOT=Date.now();
document.documentElement.classList.add('js');
try{ if(localStorage.getItem('m360.sb')==='x') document.documentElement.classList.add('sbx'); }catch(err){}

/* raw icons for the parts drawn outside React */
function IcoS(d){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'; }
var IR={
  today:IcoS('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
  feed:IcoS('<path d="M4 5.5h16v10H9l-5 3.5z"/>'),
  tasks:IcoS('<rect x="3.5" y="4" width="5" height="16" rx="1.6"/><rect x="10" y="4" width="5" height="11" rx="1.6"/><rect x="16.5" y="4" width="4" height="7" rx="1.6"/>'),
  projects:IcoS('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'),
  pitches:IcoS('<path d="M3.5 17.5l5.5-6 4 4 7.5-9"/><path d="M15.5 6.5h5v5"/>'),
  week:IcoS('<rect x="3.5" y="5" width="17" height="15" rx="2.4"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  handbook:IcoS('<path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/>'),
  clients:IcoS('<rect x="3.5" y="7" width="17" height="12.5" rx="2.4"/><path d="M9 7V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2V7M3.5 12.5h17"/>'),
  people:IcoS('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17.2" cy="9.5" r="2.4"/><path d="M16 14.2a4.8 4.8 0 0 1 5 5.3"/>'),
  leave:IcoS('<path d="M4 19.5h16M6.5 19.5c0-5 2.5-9.5 5.5-12.5 3 3 5.5 7.5 5.5 12.5"/><path d="M12 7v12.5"/>'),
  desk:IcoS('<path d="M3.5 9.5h17v10h-17z"/><path d="M7.5 9.5V6.5a4.5 4.5 0 0 1 9 0v3"/>'),
  command:IcoS('<rect x="3.5" y="4" width="17" height="12" rx="2.2"/><path d="M8 20h8M12 16v4M7 12l2.5-3 2.5 2 3-4"/>'),
  scores:IcoS('<path d="M7 20.5h10M12 16.5v4"/><path d="M6.5 3.5h11v5.5a5.5 5.5 0 0 1-11 0z"/><path d="M6.5 6H3.5a2.5 2.5 0 0 0 2.5 4M17.5 6h3a2.5 2.5 0 0 1-2.5 4"/>'),
  hiring:IcoS('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M17 4.5l1 1 2-2"/>'),
  voice:IcoS('<path d="M4 6.5h16v9H10l-4 3.5v-3.5H4z"/><path d="M8 11h8"/>'),
  search:IcoS('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>')
};

/* a tiny event bus between React and the parts outside it */
var EVB={l:{}, on:function(n,f){ (this.l[n]=this.l[n]||[]).push(f); }, off:function(n,f){ this.l[n]=(this.l[n]||[]).filter(function(x){ return x!==f; }); }, emit:function(n,d){ (this.l[n]||[]).slice().forEach(function(f){ try{ f(d); }catch(err){} }); }};

/* the m360 mark as a live character: breathes, blinks, watches, feels, and looks at what it is talking about */
var MK=(function(){
  var roots=[], stateCls={}, bound=false;
  var v={lean:0,sq:0,ex:0,ey:0}, vel={lean:0,sq:0,ex:0,ey:0}, tg={lean:0,sq:0,ex:0,ey:0};
  var running=false, last=0, lastIn=pnow(), lastMove=pnow(), sleeping=false, concern=false, baseLean=0, holdT=0, hold=false, lookT=0, moodN=-1;
  function scan(){
    roots=$qa('.lm').filter(function(el){ return $q('.l-react',el); }).map(function(el){ return {el:el, st:$q('.l-st',el), react:$q('.l-react',el), pose:$q('.l-pose',el), eye:$q('.l-eye',el), dot:$q('.l-dot',el)}; });
    roots.forEach(function(o){ Object.keys(stateCls).forEach(function(c){ if(o.st) o.st.classList.toggle(c,!!stateCls[c]); });
      var host=o.el.parentNode; if(host && !host.__mk){ host.__mk=1; host.addEventListener('pointerenter',function(){ if(!sleeping) react('wig',780); }); } });
    apply();
  }
  function vis(){ for(var i=0;i<roots.length;i++){ if(roots[i].el.isConnected && roots[i].el.getClientRects().length) return roots[i]; } return null; }
  function apply(){ var p='rotate('+v.lean.toFixed(3)+'deg) scale('+(1-v.sq/220).toFixed(4)+','+(1+v.sq/100).toFixed(4)+')'; var e='translate('+v.ex.toFixed(2)+'px,'+v.ey.toFixed(2)+'px)';
    roots.forEach(function(o){ if(o.pose) o.pose.style.transform=p; if(o.eye) o.eye.style.transform=e; }); }
  function step(t){ var dt=Math.min(.034,Math.max(.001,(t-last)/1000)); last=t; var moving=false;
    for(var k in v){ var a=170*(tg[k]-v[k])-17*vel[k]; vel[k]+=a*dt; v[k]+=vel[k]*dt; if(Math.abs(vel[k])>.02||Math.abs(tg[k]-v[k])>.02) moving=true; }
    apply(); if(moving) requestAnimationFrame(step); else running=false; }
  function kick(){ if(!running&&!RM){ running=true; last=pnow(); requestAnimationFrame(step); } }
  function set(o){ for(var k in o) tg[k]=o[k]; kick(); }
  function react(name,ms){ if(RM) return; roots.forEach(function(o){ var r=o.react; if(!r) return; r.className='l-react'; r.getBoundingClientRect(); r.className='l-react r-'+name; clearTimeout(o.rt); o.rt=setTimeout(function(){ r.className='l-react'; },ms||900); }); }
  function state(c,on){ stateCls[c]=on; roots.forEach(function(o){ if(o.st) o.st.classList.toggle(c,on); }); }
  function blinkOnce(){ roots.forEach(function(o){ if(!o.dot) return; o.dot.classList.remove('blink'); o.dot.getBoundingClientRect(); o.dot.classList.add('blink'); }); setTimeout(function(){ roots.forEach(function(o){ if(o.dot) o.dot.classList.remove('blink'); }); },230); }
  function blink(){ if(!sleeping){ blinkOnce(); if(Math.random()<.25) setTimeout(blinkOnce,330); } setTimeout(blink,2400+Math.random()*3600); }
  function sleepNow(){ if(sleeping) return; sleeping=true; state('s-sleep',true); set({ex:-10,ey:24,lean:-4,sq:0}); }
  function wake(){ lastIn=pnow(); if(sleeping){ sleeping=false; state('s-sleep',false); react('pop',520); set({ex:0,ey:0,lean:baseLean}); } }
  function glance(){ if(!sleeping&&!concern&&!hold&&pnow()-lastMove>3500){ var a=Math.random()*Math.PI*2, f=.45+Math.random()*.55; set({ex:Math.cos(a)*50*f,ey:Math.sin(a)*32*f}); setTimeout(function(){ if(pnow()-lastMove>3500&&!hold) set({ex:0,ey:0}); },650+Math.random()*700); } setTimeout(glance,2300+Math.random()*2400); }
  function bind(){
    if(bound) return; bound=true;
    addEventListener('pointermove',function(e){ lastMove=pnow(); wake(); if(hold) return; var o=vis(); if(!o) return; var r=o.el.getBoundingClientRect(); if(!r.width) return;
      var dx=e.clientX-(r.left+r.width*.6), dy=e.clientY-(r.top+r.height*.5), d=Math.hypot(dx,dy)||1, f=Math.min(1,d/240);
      baseLean=clampN(dx/900,-1,1)*2.6; set({ex:dx/d*f*54, ey:dy/d*f*36, lean:concern?baseLean-3.5:baseLean}); },{passive:true});
    ['keydown','pointerdown','touchstart','wheel'].forEach(function(n){ addEventListener(n,wake,{passive:true}); });
    setInterval(function(){ if(!sleeping&&pnow()-lastIn>45000) sleepNow(); },1000);
    var sy=scrollY, st=pnow(), sT=0;
    addEventListener('scroll',function(){ var t=pnow(), y=scrollY, dt=Math.max(8,t-st), sp=(y-sy)/dt; sy=y; st=t; wake();
      set({sq:Math.min(14,Math.abs(sp)*6), lean:clampN(sp*3.2,-6,6)}); clearTimeout(sT); sT=setTimeout(function(){ set({sq:0,lean:baseLean}); },110); },{passive:true});
    document.addEventListener('pointerover',function(e){ var h=e.target.closest&&e.target.closest('.hotz');
      if(h&&!concern){ concern=true; state('s-concern',true); set({lean:baseLean-3.5}); }
      else if(!h&&concern){ concern=false; state('s-concern',false); set({lean:baseLean}); } });
    setTimeout(blink,1800); setTimeout(glance,3000);
    var hr=new Date().getHours(); setTimeout(function(){ if(hr<5) sleepNow(); else if(hr<12) react('stretch',1600); else react('nod',680); },900);
  }
  return {
    scan:function(){ scan(); bind(); },
    happy:function(){ react('hop',820); state('s-happy',true); clearTimeout(holdT); holdT=setTimeout(function(){ state('s-happy',false); },1100); },
    nod:function(){ react('nod',680); }, pop:function(){ react('pop',520); }, spin:function(){ react('spin',1080); }, stretch:function(){ react('stretch',1600); },
    ahem:function(){ if(!sleeping) react('ahem',780); },
    think:function(on){ state('s-think',on); },
    lookAt:function(el,ms){ if(!el||RM) return; var o=vis(); if(!o) return; var r=o.el.getBoundingClientRect(), t=el.getBoundingClientRect(), dx=t.left+t.width/2-(r.left+r.width*.6), dy=t.top+t.height/2-(r.top+r.height/2), d=Math.hypot(dx,dy)||1; hold=true; set({ex:dx/d*56,ey:dy/d*38}); clearTimeout(lookT); lookT=setTimeout(function(){ hold=false; },ms||1800); },
    mood:function(n){ if(n===moodN) return; moodN=n; state('s-alert',n>=4); state('s-calm',n===0); },
    listen:function(on){ state('s-listen',on); set(on?{lean:3,ex:30,ey:-26}:{lean:baseLean,ex:0,ey:0}); }
  };
})();
var LIVE=window.__M360_LIVE__||'';
/* REACT: the live mark as a component. Any framework works: render live-mark.html inside <span class="lm">, call MK.scan() after it mounts. */
var LiveMark=React.memo(function LiveMark(){ useEffect(function(){ MK.scan(); },[]); return html`<span class="lm" aria-hidden="true" dangerouslySetInnerHTML=${{__html:LIVE}}></span>`; });

/* smooth scroll, flash and the open requests that let Ask land on a row */
function glide(y,done){
  var from=scrollY, to=clampN(y,0,Math.max(0,document.documentElement.scrollHeight-innerHeight)), d=clampN(Math.abs(to-from)*.45,520,1100), t0=0;
  if(RM||Math.abs(to-from)<2){ scrollTo(0,to); if(done) done(); return; }
  var ez=function(t){ return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; };
  var f=function(ts){ if(!t0) t0=ts; var p=Math.min(1,(ts-t0)/d); scrollTo(0,from+(to-from)*ez(p)); if(p<1) requestAnimationFrame(f); else if(done) done(); };
  requestAnimationFrame(f);
}
function glideTo(el,done){ var off=phone()?96:32; glide(el.getBoundingClientRect().top+scrollY-off,done); }
function flash(els){ (els||[]).forEach(function(el){ if(!el) return; el.classList.remove('flash','flash-out'); el.getBoundingClientRect(); el.classList.add('flash'); setTimeout(function(){ el.classList.add('flash-out'); },1600); setTimeout(function(){ el.classList.remove('flash','flash-out'); },2000); }); }
function showAt(page, sel, opts){
  opts=opts||{}; var same=CUR.page===page && !CUR.hash.split('/')[1];
  if(opts.att!=null){ PEND.att=opts.att; EVB.emit('att',opts.att); }
  if(!same && CUR.go) CUR.go(page);
  var tries=0;
  var look=function(){ var els=$qa(sel); if(!els.length){ if(tries++<12) return setTimeout(look,90); return; }
    glideTo(els[0],function(){ flash(els.slice(0,6)); MK.lookAt(els[0],2200); }); };
  setTimeout(look, same?80:260);
}
function openReq(page,id){ window.__m360open={page:page,id:id}; if(CUR.page===page && !CUR.hash.split('/')[1]) window.dispatchEvent(new Event('m360open')); else if(CUR.go) CUR.go(page); }
/* REACT: lets Ask open a record's drawer on its page. Port to the router you use. */
function useOpenReq(page,fn){
  var r=useRef(fn); r.current=fn;
  useEffect(function(){ var chk=function(){ var q=window.__m360open; if(q && q.page===page){ window.__m360open=null; setTimeout(function(){ r.current(q.id); },60); } }; chk(); window.addEventListener('m360open',chk); return function(){ window.removeEventListener('m360open',chk); }; },[]);
}

/* the island: one black object for asking, answers, confirmations and live news */
var ISL=(function(){
  var isl=null, isIn=null, its=[], mode='', queue=[], onTap=null, acts={};
  function el(){ if(isl) return; isl=document.createElement('div'); isl.id='island'; isl.setAttribute('role','status'); isl.setAttribute('aria-live','polite'); isl.innerHTML='<div class="is-in"></div>'; document.body.appendChild(isl); isIn=$q('.is-in',isl);
    isl.addEventListener('click',function(e){ if(mode==='cmd') return; var b=e.target.closest('[data-act]'); if(b){ e.stopPropagation(); var f=acts[b.getAttribute('data-act')]; close(); if(f) f(); return; } var t=onTap; close(); if(t) t(); }); }
  function cx(){ if(phone()) return innerWidth/2; var s=$q('#side'), r=s?s.getBoundingClientRect():null; return ((r?r.right:0)+12+innerWidth-12)/2; }
  function topY(){ return phone()?8:12; }
  function put(l,t,w,h,rad){ isl.style.left=l+'px'; isl.style.top=t+'px'; isl.style.width=w+'px'; isl.style.height=h+'px'; isl.style.borderRadius=rad+'px'; }
  function shape(w,h,r){ put(cx()-w/2,topY(),w,h,r); }
  function pill(){ shape(120,36,18); }
  function clr(){ its.forEach(clearTimeout); its=[]; }
  function later(fn,ms){ its.push(setTimeout(fn,ms)); }
  function isOpen(){ return !!isl && isl.classList.contains('open') && !isl.classList.contains('closing'); }
  function busy(){ return !!isl && isl.classList.contains('show'); }
  function W(n){ return phone()?innerWidth-16:(n||440); }
  function swapI(h,cb){ isIn.classList.add('fade'); later(function(){ isIn.innerHTML=h; isIn.classList.remove('fade'); if(cb) cb(); },200); }
  function open(h,opt){ el(); opt=opt||{}; var w=opt.w||W(), hh=opt.h||72, r=opt.r||36;
    if(isOpen()){ clr(); if(mode==='cmd'){ isl.classList.remove('cmd'); mode=''; } swapI(h,opt.cb); shape(w,hh,r); return; }
    clr(); isl.classList.remove('closing','open','cmd'); mode=''; isl.style.transition='none';
    if(opt.from){ var f=opt.from; put(f.left,f.top,f.width,f.height,f.height/2); } else pill();
    isl.getBoundingClientRect(); isl.style.transition='';
    isIn.classList.remove('fade'); isIn.innerHTML=h; isl.classList.add('show'); if(opt.cb) opt.cb();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ var sz=opt.size?opt.size():null; if(sz) shape(sz[0],sz[1],sz[2]); else shape(w,hh,r); isl.classList.add('open'); }); });
  }
  function close(){ clr(); if(!busy()) return; var wasCmd=mode==='cmd'; isl.classList.remove('open'); isl.classList.add('closing'); pill(); mode=''; onTap=null; acts={};
    if(wasCmd){ var a=document.activeElement; if(a&&a.blur) a.blur(); }
    later(function(){ isl.classList.remove('show','closing','cmd'); isIn.innerHTML=''; if(queue.length){ var q=queue.shift(); setTimeout(q,350); } },460); MK.think(false); }
  var TX=function(b,e){ return '<span class="is-t"><b>'+esc(b)+'</b>'+(e?'<em>'+esc(e)+'</em>':'')+'</span>'; };
  var DOT='<span class="is-ev"></span>';
  var CK='<span class="is-ck"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span>';
  var BAD='<span class="is-ck bad"><svg viewBox="0 0 24 24"><path d="M12 6.5v7M12 17v.5"/></svg></span>';
  function toast(msg,bad){ acts={}; onTap=null; open((bad?BAD:CK)+TX(msg, bad?'check this':'done')); later(close, bad?4200:2600); if(bad) MK.ahem(); else MK.happy(); }
  function confirm(msg,cap,undo){ acts={}; onTap=null; open(CK+TX(msg,cap)+(undo?'<button class="ib" type="button" data-act="undo">UNDO</button>':''),{w:W(480)}); if(undo) acts.undo=undo; later(close,5200); MK.happy(); }
  function notify(text,cap,tap,look){ var run=function(){ acts={}; open(DOT+TX(text,cap)); onTap=tap||null; later(close,4200); MK.pop(); if(look) setTimeout(function(){ MK.lookAt(look,1800); },200); };
    if(busy()||document.documentElement.classList.contains('gs-open')) queue.push(function(){ if(busy()) queue.push(run); else run(); }); else run(); }

  /* ask m360: answers come from the OS itself, enter takes you there */
  /* voice: if the OS has voice, register it with ISL.setVoice(fn) and drive the island with ISL.voice(stage,text,caption,onShow)
     stages: 'listening' | 'heard' | 'thinking' | 'answer'. The mic shows in the Ask bar only when a voice handler is set. */
  var voiceFn=null;
  var WV=function(calm){ return '<span class="is-wave'+(calm?' calm':'')+'"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i><i style="--k:3"></i><i style="--k:4"></i></span>'; };
  function voice(stage,text,cap,onShow){ acts={}; onTap=null; clr();
    if(stage==='listening'){ open(WV()+TX('Listening','ask m360')+'<i class="is-mic"></i>'); MK.listen(true); return; }
    if(stage==='heard'){ open(WV()+TX('\u201c'+text+'\u201d','you')+'<i class="is-mic"></i>'); return; }
    if(stage==='thinking'){ MK.listen(false); MK.think(true); open(WV(1)+TX('Thinking','m360')); return; }
    MK.listen(false); MK.think(false); MK.nod(); open(WV(1)+TX(text,cap||'')+(onShow?'<button class="ib" type="button" data-act="show">SHOW</button>':''),{w:W(520)}); if(onShow) acts.show=onShow; later(close,8200); }
  var cbI=null, cbL=null, items=[], sel=0;
  function mark(){ $qa('.cbo',cbL).forEach(function(b,i){ b.classList.toggle('cur',i===sel); }); var s=$q('.cbo.cur',cbL); if(s&&s.scrollIntoView) s.scrollIntoView({block:'nearest'}); }
  function cbDims(){ var lh=cbL?cbL.scrollHeight:56, cap=phone()?Math.round(innerHeight*.56):392; return [W(600),64+Math.min(lh,cap),28]; }
  function render(q){ items=SEARCH((q||'').trim()); sel=0;
    cbL.innerHTML=items.length?items.map(function(it,i){ return (it.hd?'<div class="cbh">'+esc(it.hd)+'</div>':'')+'<button type="button" class="cbo'+(it.ans?' ans':'')+(i===0?' cur':'')+'" data-i="'+i+'"><span class="ic'+(it.round?' r':'')+'">'+it.ic+'</span><span class="tx"><b>'+esc(it.t)+'</b>'+(it.s?'<em>'+esc(it.s)+'</em>':'')+'</span><span class="rt">'+esc(it.r||'')+'</span></button>'; }).join(''):'<div class="cbe">No match yet. Try a name, a client, a page or who is late.</div>';
    if(mode==='cmd'){ var d=cbDims(); shape(d[0],d[1],d[2]); } }
  function runItem(it){ if(!it) return; if(it.q){ cbI.value=it.q; render(it.q); return; } close(); setTimeout(function(){ try{ it.run(); }catch(err){} },240); }
  function openCmd(q,from){ el();
    var MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/></svg>';
    var H0='<div class="cb"><div class="cbr">'+(voiceFn?'<button class="cbm" type="button" aria-label="Speak">'+MIC+'</button>':IR.search)+'<input id="cbi" type="text" placeholder="Ask m360 or jump to anything" autocomplete="off" spellcheck="false" aria-label="Ask m360"><kbd class="kb cbk">esc</kbd></div><div class="cbl" id="cbl" role="listbox"></div></div>';
    var start=function(){ isl.classList.add('cmd'); mode='cmd'; cbI=$q('#cbi'); cbL=$q('#cbl'); cbI.value=q||''; render(q||'');
      cbI.addEventListener('input',function(){ render(cbI.value); });
      cbI.addEventListener('keydown',function(e){ if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(!items.length) return; sel=(sel+(e.key==='ArrowDown'?1:-1)+items.length)%items.length; mark(); } else if(e.key==='Enter'){ e.preventDefault(); runItem(items[sel]); } else if(e.key==='Escape'){ e.preventDefault(); close(); } });
      cbL.addEventListener('click',function(e){ var b=e.target.closest('.cbo'); if(b) runItem(items[+b.getAttribute('data-i')]); });
      cbL.addEventListener('pointermove',function(e){ var b=e.target.closest('.cbo'); if(!b) return; var i=+b.getAttribute('data-i'); if(i!==sel){ sel=i; mark(); } });
      var mb=$q('.cbm',isl); if(mb) mb.addEventListener('click',function(){ if(voiceFn) voiceFn(); });
      setTimeout(function(){ try{ cbI.focus({preventScroll:true}); }catch(err){ cbI.focus(); } },120);
      MK.lookAt(isl,1400); };
    if(isOpen()){ clr(); isl.classList.add('cmd'); mode='cmd'; isIn.innerHTML=H0; start(); return; }
    open(H0,{from:from||null, w:W(600), h:120, r:28, cb:start, size:cbDims});
  }
  document.addEventListener('pointerdown',function(e){ if(mode==='cmd'&&isl&&!isl.contains(e.target)&&!(e.target.closest&&e.target.closest('.c-askf,#sAsk,.tb-ask'))) close(); });
  addEventListener('resize',function(){ if(!busy()) return; if(mode==='cmd'){ var d=cbDims(); shape(d[0],d[1],d[2]); } else if(isOpen()) shape(W(), isl.offsetHeight, 36); });
  return {open:open, close:close, toast:toast, confirm:confirm, notify:notify, cmd:openCmd, voice:voice, setVoice:function(fn){ voiceFn=fn||null; }, isCmd:function(){ return mode==='cmd'; }};
})();

/* what the OS knows, for asking.
   ADAPT from here to SEARCH: needsOf, liveEvents, INDEX, INTENTS and SUGG read the artifact's data helpers
   (checkinOf, eodOf, lateMins, tasksOf, pitchValue, rankAll, evaluateRules output and so on).
   Rewrite them against this OS's data. Keep the shapes they return: the island and Command read those. */
function needsOf(ctx){
  var out=[]; if(!ctx || !ctx.isFounder) return out;
  Object.keys(ctx.leave||{}).forEach(function(uid){ var dec=((ctx.leavedec[uid]||{}).d)||{}; ((ctx.leave[uid]||{}).reqs||[]).forEach(function(r){ if(!dec[r.id]) out.push({k:'lv:'+uid+':'+r.id, kind:'leave', uid:uid, r:r, at:r.at||0}); }); });
  Object.keys(ctx.joinreq||{}).forEach(function(uid){ var m=((ctx.roster||{}).members||{})[uid]; if(!m || m.active===false) out.push({k:'jr:'+uid, kind:'join', uid:uid, at:(ctx.joinreq[uid]||{}).at||0}); });
  Object.keys(ctx.candidates||{}).forEach(function(cid){ var c=ctx.candidates[cid]; if(!c || c.decision || c.stage==='hired' || c.stage==='rejected') return; var evs=c.evaluators||[]; var n=Object.keys(evalsFor(ctx,cid)).length;
    if(evs.indexOf(ctx.meId)>-1 && !((ctx.evals[ctx.meId]||{}).e||{})[cid]) out.push({k:'ev:'+cid, kind:'eval', cid:cid, c:c, n:n, at:c.created||0});
    else if(evs.length && n>=evs.length) out.push({k:'hd:'+cid, kind:'decide', cid:cid, c:c, n:n, at:c.created||0}); });
  var sorted=out.sort(function(a,b){ return (a.at||0)-(b.at||0); });
  (ctx.flags||[]).filter(function(f){ return f.sev==='high'; }).forEach(function(f,i){ sorted.push({k:'fl:'+f.rule+':'+f.uid+':'+i, kind:'flag', f:f, uid:f.uid, at:0}); });
  return sorted;
}
function leaveRange(r){ return fmtDay(r.from)+(r.to!==r.from?' to '+fmtDay(r.to):''); }
function flagGo(f){ if(f.ref==='handbook') return 'handbook/'+f.section; if(f.ref==='today'||f.ref==='week'||f.ref==='people') return (CUR.ctx&&f.uid===CUR.ctx.meId)?'today':'people/'+f.uid; return f.ref||'today'; }
function liveEvents(ctx){
  var t=todayStr(), ev=[], since=Date.now()-36*3600000;
  (ctx.ids||[]).forEach(function(uid){ var ci=checkinOf(ctx,uid,t);
    if(ci){ ev.push({k:'ci:'+uid+':'+t, at:ci.in, uid:uid, text:ctx.nm(uid)+' checked in, '+hm(ci.in)+', '+(ci.mode==='wfh'?'WFH':'office'), cap:'check in', go:'people/'+uid});
      if(ci.out) ev.push({k:'co:'+uid+':'+t, at:ci.out, uid:uid, text:ctx.nm(uid)+' checked out, '+hm(ci.out), cap:'check out', go:'people/'+uid}); }
    var ed=eodOf(ctx,uid,t); if(ed) ev.push({k:'eod:'+uid+':'+t, at:ed.at, uid:uid, text:ctx.nm(uid)+' posted the EOD line'+(ed.blocked?', blocked':''), cap:'eod', go:'week'}); });
  Object.keys(ctx.feed||{}).forEach(function(uid){ ((ctx.feed[uid]||{}).posts||[]).forEach(function(po){ if((po.at||0)>since) ev.push({k:'fd:'+uid+':'+po.id, at:po.at, uid:uid, text:ctx.nm(uid)+(po.kind==='win'?' shared a win':po.kind==='question'?' asked a question':po.kind==='announce'?' posted an announcement':' posted an update'), cap:'feed', go:'feed'}); }); });
  Object.keys(ctx.kudos||{}).forEach(function(g){ ((ctx.kudos[g]||{}).given||[]).forEach(function(kd){ if((kd.at||0)>since) ev.push({k:'kd:'+g+':'+(kd.id||kd.at), at:kd.at, uid:g, to:kd.to, text:ctx.nm(g)+' gave kudos to '+(kd.to===ctx.meId?'you':ctx.nm(kd.to)), cap:'kudos', go:'feed'}); }); });
  if(ctx.isFounder){
    Object.keys(ctx.leave||{}).forEach(function(uid){ var dec=((ctx.leavedec[uid]||{}).d)||{}; ((ctx.leave[uid]||{}).reqs||[]).forEach(function(r){ if(!dec[r.id]) ev.push({k:'lv:'+uid+':'+r.id, at:r.at||0, uid:uid, text:ctx.nm(uid)+' asked for leave, '+leaveRange(r), cap:'leave', go:'command'}); }); });
    Object.keys(ctx.joinreq||{}).forEach(function(uid){ var m=((ctx.roster||{}).members||{})[uid]; if(!m||m.active===false) ev.push({k:'jr:'+uid, at:(ctx.joinreq[uid]||{}).at||0, uid:uid, text:ctx.nm(uid)+' asked to join the OS', cap:'join', go:'desk'}); });
    Object.keys(ctx.pulse||{}).forEach(function(k){ var x=ctx.pulse[k]; if((x.at||0)>since) ev.push({k:'pu:'+k, at:x.at, text:'A pulse came in, energy '+x.energy+' of 5', cap:'pulse', go:'voice'}); });
  }
  return ev.sort(function(a,b){ return (b.at||0)-(a.at||0); });
}
var PAGE_IC={today:'today',tasks:'tasks',projects:'projects',pitches:'pitches',clients:'clients',feed:'feed',week:'week',scores:'scores',people:'people',hiring:'hiring',handbook:'handbook',voice:'voice',leave:'leave',command:'command',desk:'desk'};
function pIc(k){ return IR[PAGE_IC[k]||'command']||IR.command; }
function avIc(name){ return esc(ini(name)||'?'); }
function INDEX(ctx){
  var out=[], t=todayStr(), push=function(o){ out.push(o); };
  (CUR.nav||[]).forEach(function(n){ push({o:0, k:'page', ic:pIc(n[0]), t:n[1], s:'Page', w:(n[1]+' '+n[0]+' page '+(n[4]||'')).toLowerCase(), run:function(){ CUR.go(n[0]); }}); });
  var mem=(ctx.roster||{}).members||{};
  Object.keys(mem).filter(function(id){ return mem[id] && mem[id].active!==false; }).forEach(function(id){ var m=mem[id]; var st=STATUS_LABEL[statusOf(ctx,id,t)]||''; push({o:1, k:'person', round:1, ic:avIc(ctx.nm(id)), t:ctx.nm(id), s:[m.title,m.pod,st].filter(Boolean).join(', '), w:(ctx.nm(id)+' '+(m.title||'')+' '+(m.pod||'')+' person people').toLowerCase(), run:function(){ CUR.go('people/'+id); }}); });
  Object.keys(ctx.projects||{}).forEach(function(k){ var x=ctx.projects[k]; if(x.archived) return; var pg=projProgress(ctx,k); push({o:2, k:'project', ic:IR.projects, t:x.name||'Project', s:'Project, '+(x.status==='off'?'off track':x.status==='risk'?'at risk':x.status==='done'?'done':'on track')+', '+pg.pct+'%', w:((x.name||'')+' project').toLowerCase(), run:function(){ CUR.go('projects/'+k); }}); });
  Object.keys(ctx.clients||{}).forEach(function(k){ var c=ctx.clients[k]; push({o:3, k:'client', ic:IR.clients, t:c.name||'Client', s:'Client, '+(c.status||'live'), w:((c.name||'')+' client brand').toLowerCase(), run:function(){ openReq('clients',k); }}); });
  Object.keys(ctx.pitches||{}).forEach(function(k){ var x=ctx.pitches[k]; push({o:4, k:'pitch', ic:IR.pitches, t:x.brand||'Pitch', s:'Pitch, '+(STAGE_LABEL[x.stage]||'Lead').toLowerCase(), w:((x.brand||'')+' '+(x.category||'')+' pitch deal').toLowerCase(), run:function(){ openReq('pitches',k); }}); });
  Object.keys(ctx.tasks||{}).forEach(function(k){ var x=ctx.tasks[k]; if(x.status==='done' && x.owner!==ctx.meId) return; push({o:5, k:'task', ic:IR.tasks, t:x.title||'Task', s:'Task, '+ctx.nm(x.owner)+(x.due?', due '+fmtDay(x.due):'')+(x.status==='done'?', done':''), w:((x.title||'')+' task').toLowerCase(), run:function(){ openReq('tasks',k); }}); });
  Object.keys(ctx.candidates||{}).forEach(function(k){ var c=ctx.candidates[k]; if(!ctx.isFounder && (c.evaluators||[]).indexOf(ctx.meId)<0) return; push({o:6, k:'cand', round:1, ic:avIc(c.name), t:c.name||'Candidate', s:'Candidate, '+(c.role||'').toLowerCase(), w:((c.name||'')+' '+(c.role||'')+' candidate hiring').toLowerCase(), run:function(){ CUR.go('hiring/'+k); }}); });
  (ctx.hbIds||[]).forEach(function(k){ var h=ctx.handbook[k]||{}; push({o:7, k:'hb', ic:IR.handbook, t:h.title||k, s:'Handbook', w:((h.title||k)+' handbook rule section').toLowerCase(), run:function(){ CUR.go('handbook/'+k); }}); });
  return out;
}
function ansPipe(ctx){ var w=0, n=0, by={}; Object.keys(ctx.pitches||{}).forEach(function(k){ var x=ctx.pitches[k]; if(x.stage==='won'||x.stage==='lost') return; var pv=pitchValue(ctx,k); w+=pv.weighted; n++; by[x.stage]=(by[x.stage]||0)+pv.weighted; }); var top=Object.keys(by).sort(function(a,b){ return by[b]-by[a]; })[0]; return {w:w, n:n, top:top}; }
function ansLargest(ctx){ var fin=((ctx.finance||{}).clients)||{}; var rows=Object.keys(ctx.clients||{}).map(function(k){ return [k,(fin[k]||{}).monthly||0]; }).sort(function(a,b){ return b[1]-a[1]; }); var tot=rows.reduce(function(s,r){ return s+r[1]; },0); return {rows:rows, tot:tot}; }
function ansEnergy(ctx){ var ps=Object.keys(ctx.pulse||{}).map(function(k){ return ctx.pulse[k]; }); var wks=ps.map(function(x){ return x.week; }).filter(Boolean).sort(); var lw=wks[wks.length-1]; var vals=ps.filter(function(x){ return x.week===lw; }).map(function(x){ return x.energy||0; }); return {lw:lw, n:vals.length, e:vals.length?vals.reduce(function(a,b){ return a+b; },0)/vals.length:null}; }
var INTENTS=[
  {re:/\blate\b|on time/, a:function(ctx){ var t=todayStr(); var ins=ctx.ids.filter(function(id){ return checkinOf(ctx,id,t); }); var l=ins.filter(function(id){ return lateMins(ctx,id,checkinOf(ctx,id,t))>0; });
    return {ic:IR.today, t:l.length?l.map(function(id){ return ctx.nm(id)+', in at '+hm(checkinOf(ctx,id,t).in); }).join('. ')+'.':'Nobody was late today.', s:l.length+' late, '+ins.length+' in so far', run:function(){ if(ctx.isFounder) showAt('command','#c-att .c-tr.rw',{att:l.length?'late':'all'}); else showAt('today','#t-who'); }}; }},
  {re:/not in|absent|missing|who.?s (in|out|here)|attendance|who checked/, a:function(ctx){ var t=todayStr(); var wk=ctx.ids.filter(function(id){ return isWorkingDay(ctx,id,t); }); var out=wk.filter(function(id){ return !checkinOf(ctx,id,t); });
    return {ic:IR.today, t:out.length?names(out.map(ctx.nm))+(out.length===1?' is':' are')+' not in yet.':(wk.length?'Everyone is in.':'Nobody is working today.'), s:(wk.length-out.length)+' of '+wk.length+' in today', run:function(){ if(ctx.isFounder) showAt('command','#c-att .c-tr.rw',{att:out.length?'none':'all'}); else showAt('today','#t-who'); }}; }},
  {re:/need|waiting|approv|pending|inbox/, f:1, a:function(ctx){ var n=needsOf(ctx); return {ic:IR.command, t:n.length?plural(n.length,'thing needs you.','things need you.'):'Nothing needs you right now.', s:'Approvals, panel calls and high flags', run:function(){ showAt('command','#c-need .c-nc,#c-need .c-clear'); }}; }},
  {re:/pipeline|deal|proposal|negotiat|sales|weighted/, f:1, a:function(ctx){ var p=ansPipe(ctx); return {ic:IR.pitches, t:p.n?inr(p.w)+' a month, weighted, across '+plural(p.n,'open pitch','open pitches')+'.':'No open pitches yet.', s:p.top?'Most of it in '+(STAGE_LABEL[p.top]||'').toLowerCase():'Add pitches to see the pipeline', run:function(){ showAt('command','#c-pipe'); }}; }},
  {re:/client|revenue|biggest|largest|account/, f:1, a:function(ctx){ var L=ansLargest(ctx); if(!L.tot) return {ic:IR.clients, t:'No client revenue set yet.', s:'Set a monthly figure on each client', run:function(){ CUR.go('clients'); }}; var k=L.rows[0][0], v=L.rows[0][1], pc=Math.round(100*v/L.tot);
    return {ic:IR.clients, t:(ctx.clients[k].name||'Client')+', '+inr(v)+' a month.', s:pc+'% of revenue'+(pc>25?', above the 25% line':''), run:function(){ showAt('command','#c-cli [data-id="'+k+'"]'); }}; }},
  {re:/leader|score|point|\btop\b|best|winning|podium/, a:function(ctx){ var rows=rankAll(ctx,'week',ctx.now).rows; if(!rows.length) return {ic:IR.scores, t:'Nobody on the board yet.', s:'This week', run:function(){ CUR.go('scores'); }};
    return {ic:IR.scores, t:ctx.nm(rows[0].uid)+' leads with '+plural(rows[0].total,'point')+'.', s:rows[1]?ctx.nm(rows[1].uid)+' second on '+rows[1].total:'This week', run:function(){ if(ctx.isFounder) showAt('command','#c-lb .c-lbr'); else CUR.go('scores'); }}; }},
  {re:/flag|rule/, a:function(ctx){ if(ctx.isFounder){ var f=ctx.flags, h=f.filter(function(x){ return x.sev==='high'; }); var who=[]; h.forEach(function(x){ var n=ctx.nm(x.uid); if(who.indexOf(n)<0) who.push(n); });
      return {ic:IR.handbook, t:f.length?plural(f.length,'flag')+', '+h.length+' high.':'No flags. All clear.', s:who.length?names(who.slice(0,3))+' need a look':'The rules are quiet', run:function(){ showAt('command','#c-flg'); }}; }
    var mine=ctx.flags.filter(function(x){ return x.uid===ctx.meId; }); return {ic:IR.handbook, t:mine.length?'You have '+plural(mine.length,'open flag')+'.':'Your rule box is clear.', s:mine[0]?mine[0].name:'All clear', run:function(){ showAt('today','#t-rules'); }}; }},
  {re:/energy|mood|pulse|morale/, f:1, a:function(ctx){ var E=ansEnergy(ctx); return {ic:IR.voice, t:E.e!=null?'Team energy '+E.e.toFixed(1)+' of 5 in week '+weekNum(E.lw)+'.':'No pulse yet.', s:E.n?plural(E.n,'reply','replies')+', anonymous':'Pulses are anonymous', run:function(){ showAt('command','#c-vox'); }}; }},
  {re:/hir|candidate|interview|panel|evaluat/, a:function(ctx){ var me=ctx.meId; if(ctx.isFounder){ var cs=Object.keys(ctx.candidates).filter(function(k){ return !ctx.candidates[k].decision; }); if(!cs.length) return {ic:IR.hiring, t:'Nobody in the panel.', s:'Hiring', run:function(){ CUR.go('hiring'); }}; var c=ctx.candidates[cs[0]];
      return {ic:IR.hiring, t:plural(cs.length,'candidate')+' in the panel. '+(c.name||'')+' is at '+Object.keys(evalsFor(ctx,cs[0])).length+' of '+(c.evaluators||[]).length+'.', s:'Panel reads', run:function(){ showAt('command','#c-hire'); }}; }
    var mine=Object.keys(ctx.candidates).filter(function(k){ var c=ctx.candidates[k]; return c && !c.decision && (c.evaluators||[]).indexOf(me)>-1 && !((ctx.evals[me]||{}).e||{})[k]; });
    return {ic:IR.hiring, t:mine.length?'You have '+plural(mine.length,'evaluation')+' to write.':'No evaluations assigned to you.', s:'Hiring panel', run:function(){ CUR.go('hiring'); }}; }},
  {re:/project|off track|at risk|delivery/, a:function(ctx){ var ks=Object.keys(ctx.projects).filter(function(k){ var x=ctx.projects[k]; return !x.archived && x.status!=='done'; }); var ph={on:0,risk:0,off:0}; ks.forEach(function(k){ ph[ctx.projects[k].status||'on']=(ph[ctx.projects[k].status||'on']||0)+1; });
    var worst=ks.filter(function(k){ return ctx.projects[k].status==='off'; })[0]||ks.filter(function(k){ return ctx.projects[k].status==='risk'; })[0];
    return {ic:IR.projects, t:ks.length?ph.on+' on track, '+ph.risk+' at risk, '+ph.off+' off track.':'No live projects.', s:worst?(ctx.projects[worst].name||'')+' is '+(ctx.projects[worst].status==='off'?'off track':'at risk'):'Projects', run:function(){ if(ctx.isFounder&&ks.length) showAt('command','#c-proj'); else CUR.go('projects'); }}; }},
  {re:/overdue|task|\bdue\b/, a:function(ctx){ var t=todayStr(); if(ctx.isFounder){ var od=tasksOf(ctx).filter(function(x){ return x.status!=='done' && x.due && x.due<t; }); var who=[]; od.forEach(function(x){ var n=ctx.nm(x.owner); if(who.indexOf(n)<0) who.push(n); });
      return {ic:IR.tasks, t:od.length?plural(od.length,'task')+' overdue across the team.':'Nothing overdue.', s:who.length?names(who.slice(0,3)):'The board is clean', run:function(){ CUR.go('tasks'); }}; }
    var mine=tasksOf(ctx,ctx.meId).filter(function(x){ return x.status!=='done'; }); var o=mine.filter(function(x){ return x.due && x.due<t; }).length;
    return {ic:IR.tasks, t:'You have '+plural(mine.length,'open task')+(o?', '+o+' overdue':'')+'.', s:'My tasks', run:function(){ CUR.go('tasks'); }}; }},
  {re:/leave|holiday|day off|time off|vacation/, a:function(ctx){ if(ctx.isFounder){ var n=needsOf(ctx).filter(function(x){ return x.kind==='leave'; }); return {ic:IR.leave, t:n.length?plural(n.length,'leave request')+' waiting for you.':'No leave waiting.', s:'Leave', run:function(){ if(n.length) showAt('command','#c-need .c-nc'); else CUR.go('leave'); }}; }
    var reqs=((ctx.leave[ctx.meId]||{}).reqs||[]).slice().sort(function(a,b){ return (b.at||0)-(a.at||0); }); var dec=((ctx.leavedec[ctx.meId]||{}).d)||{}; var r=reqs[0];
    return {ic:IR.leave, t:r?'Your last request, '+leaveRange(r)+', is '+((dec[r.id]||{}).status||'waiting')+'.':'No leave requests yet.', s:'Leave', run:function(){ CUR.go('leave'); }}; }},
  {re:/\beod\b|end of day|shipped|blocked/, a:function(ctx){ var ed=eodOf(ctx,ctx.meId,todayStr()); return {ic:IR.today, t:ed?'Your EOD line is in, posted '+hm(ed.at)+'.':'No EOD line yet today. Cutoff is '+ctx.settings.eodCut+'.', s:'End of day', run:function(){ showAt('today','#t-eod'); }}; }},
  {re:/check ?(in|out)/, a:function(ctx){ var ci=checkinOf(ctx,ctx.meId,todayStr()); return {ic:IR.today, t:ci?'You checked in at '+hm(ci.in)+', '+(ci.mode==='wfh'?'WFH':'office')+'.':'You have not checked in yet. Start is '+startFor(ctx,ctx.meId)+'.', s:'Check in', run:function(){ showAt('today','#t-check'); }}; }}
];
function SUGG(ctx){
  var out=[], mem=(ctx.roster||{}).members||{};
  var asks=ctx.isFounder?[[IR.today,'Who is late today?','who is late today'],[IR.command,'What needs me?','what needs me'],[IR.pitches,'Pipeline this month','pipeline this month'],[IR.clients,'Biggest client','biggest client']]
    :[[IR.today,'Did I check in?','check in'],[IR.tasks,'My tasks','my tasks'],[IR.today,'Who is in today?','who is in today'],[IR.scores,'Who leads this week?','who leads this week']];
  asks.forEach(function(a,i){ out.push({hd:i===0?'Try':null, ic:a[0], t:a[1], r:'ask', q:a[2]}); });
  var ppl=ctx.ids.filter(function(id){ return id!==ctx.meId && mem[id]; }).slice(0,3);
  ppl.forEach(function(id,i){ var m=mem[id]||{}; out.push({hd:i===0?'People':null, round:1, ic:avIc(ctx.nm(id)), t:ctx.nm(id), s:m.title||'', r:'open', run:function(){ CUR.go('people/'+id); }}); });
  if(!ppl.length && ctx.isFounder) out.push({hd:'Go to', ic:IR.desk, t:'Add your team', s:'Desk, roster', r:'go', run:function(){ CUR.go('desk'); }});
  return out;
}
function SEARCH(q){
  var ctx=CUR.ctx; if(!ctx) return [];
  var ql=q.toLowerCase().replace(/[‘’]/g,"'");
  if(!ql) return SUGG(ctx);
  var out=[], hit=null;
  INTENTS.some(function(x){ if((!x.f||ctx.isFounder) && x.re.test(ql)){ try{ hit=x.a(ctx); }catch(err){ hit=null; } return !!hit; } return false; });
  if(hit){ hit.ans=true; hit.r='show'; out.push(hit); }
  var words=ql.split(/\s+/).filter(function(w){ return w.length>1 || ql.length<3; });
  var m=INDEX(ctx).filter(function(e){ return words.length && words.every(function(w){ return e.w.indexOf(w)>-1; }); });
  m.sort(function(a,b){ var as=a.t.toLowerCase().indexOf(ql)===0?0:1, bs=b.t.toLowerCase().indexOf(ql)===0?0:1; return as-bs || a.o-b.o; });
  m.slice(0,hit?5:8).forEach(function(e,i){ out.push({hd:i===0?(hit?'Jump to':null):null, ic:e.ic, round:e.round, t:e.t, s:e.s, r:e.k==='page'?'go':'open', run:e.run}); });
  return out;
}
addEventListener('keydown',function(e){
  var k=e.key||''; var tg=e.target||{}; var typing=/INPUT|TEXTAREA|SELECT/.test(tg.tagName||'')||tg.isContentEditable;
  if((e.metaKey||e.ctrlKey)&&k.toLowerCase()==='k'){ e.preventDefault(); if(ISL.isCmd()) ISL.close(); else ISL.cmd(''); return; }
  if(k==='Escape' && ISL.isCmd()){ ISL.close(); return; }
  if(typing||e.metaKey||e.ctrlKey||e.altKey) return;
  if(k==='/'){ e.preventDefault(); ISL.cmd(''); }
  else if(k==='['){ SB.toggle(); }
});

/* sidebar: black pill marks the page, warm pill follows the pointer, names on demand */
var SB=(function(){
  var side=null, snav=null, spa=null, sph=null, here=null, tip=null, tipOn=false, lastK=null, bound=false;
  function placeEl(p,el,snap,dy){ if(!p||!el) return; if(snap) p.style.transition='none'; p.style.transform='translate3d(0,'+(el.offsetTop+(dy||0))+'px,0)'; if(snap){ p.getBoundingClientRect(); p.style.transition=''; } }
  function place(snap){ if(!snav) return; var a=$q('.nv.on',snav); if(!a){ spa.style.opacity='0'; here.style.opacity='0'; lastK=null; return; } var first=!lastK; spa.style.opacity='1'; here.style.opacity='1'; placeEl(spa,a,snap||first); placeEl(here,a,snap||first,10); var k=a.getAttribute('data-k'); if(lastK && lastK!==k) MK.nod(); lastK=k; }
  function ovf(){ if(!snav) return; var t=snav.scrollTop, m=snav.scrollHeight-snav.clientHeight; snav.classList.toggle('ovt',t>2); snav.classList.toggle('ovb',m-t>2); }
  function hideTip(){ if(tip) tip.classList.remove('on'); tipOn=false; }
  function showTip(el){ if(!tip||!side) return; if(document.documentElement.classList.contains('sbx')||phone()){ hideTip(); return; }
    var r=el.getBoundingClientRect(), s=side.getBoundingClientRect(), bd=$q('.bd',el), kb=el.getAttribute('data-kb');
    tip.innerHTML=esc(el.getAttribute('data-t')||'')+(kb?'<kbd class="kb">'+esc(kb)+'</kbd>':'')+(bd?'<b class="bd">'+esc(bd.textContent)+'</b>':'');
    tip.style.setProperty('--tx',(s.right+10)+'px'); tip.style.setProperty('--ty',(r.top+r.height/2-15)+'px');
    if(!tipOn){ tip.style.transition='none'; tip.getBoundingClientRect(); tip.style.transition=''; } tip.classList.add('on'); tipOn=true; }
  function mount(el){ if(!el) return; side=el; snav=$q('.snav',el); spa=$q('.sp-a',el); sph=$q('.sp-h',el); here=$q('.here',el);
    tip=$q('#tip'); if(!tip){ tip=document.createElement('div'); tip.id='tip'; tip.className='tip'; tip.setAttribute('aria-hidden','true'); document.body.appendChild(tip); }
    snav.addEventListener('pointerover',function(e){ var b=e.target.closest('.nv'); if(!b) return; if(sph.style.opacity!=='1') placeEl(sph,b,true); else placeEl(sph,b); sph.style.opacity=b.classList.contains('on')?'0':'1'; showTip(b); });
    snav.addEventListener('pointerleave',function(){ sph.style.opacity='0'; hideTip(); });
    side.addEventListener('pointerover',function(e){ var b=e.target.closest('.sfoot .nv'); if(b) showTip(b); });
    side.addEventListener('pointerout',function(e){ var b=e.target.closest('.sfoot .nv'); if(b && !(e.relatedTarget && b.contains(e.relatedTarget))) hideTip(); });
    snav.addEventListener('scroll',function(){ hideTip(); ovf(); },{passive:true});
    if(!bound){ bound=true; addEventListener('resize',function(){ ovf(); place(true); }); }
    place(true); ovf(); setTimeout(ovf,700); }
  function toggle(){ var x=!document.documentElement.classList.contains('sbx'); document.documentElement.classList.toggle('sbx',x); try{ localStorage.setItem('m360.sb',x?'x':'s'); }catch(err){} hideTip(); MK.pop(); setTimeout(function(){ ovf(); place(true); FX.frame(); },650); EVB.emit('sb',x); }
  return {mount:mount, place:place, toggle:toggle, hideTip:hideTip, ovf:ovf};
})();

/* phone tab bar lens */
var TB={place:function(nav,snap){ if(!nav) return; var a=$q('.ptab.on',nav), lens=$q('.lens',nav); if(!lens) return; if(!a||!a.offsetWidth){ lens.style.opacity='0'; return; } lens.style.opacity='1'; var first=!lens.__p; if(first||snap) lens.style.transition='none'; lens.style.width=a.offsetWidth+'px'; lens.style.transform='translate3d('+a.offsetLeft+'px,0,0)'; if(first||snap){ lens.getBoundingClientRect(); lens.style.transition=''; } lens.__p=1; }};

/* sections rise in when they arrive, numbers count up */
function fmtCount(n,fmt){ return fmt==='inr'?inr(n):String(Math.round(n)); }
function countTo(el,to){ var fmt=el.getAttribute('data-fmt'), t0=0, d=1200; var tn=el.firstChild; if(!tn||tn.nodeType!==3) return; if(RM){ return; }
  var f=function(ts){ if(!t0) t0=ts; var p=Math.min(1,(ts-t0)/d), e=1-Math.pow(1-p,3); var fin=el.getAttribute('data-v'); if(p<1){ tn.nodeValue=fmtCount(to*e,fmt); requestAnimationFrame(f); } else tn.nodeValue=fin!=null?fin:fmtCount(to,fmt); };
  requestAnimationFrame(f); }
var RV=(function(){ var io=null;
  function see(el){ el.classList.add('seen'); $qa('[data-n]',el).forEach(function(n){ var to=+n.getAttribute('data-n')||0; if(to) countTo(n,to); }); }
  return {scan:function(root){ var els=$qa('.rv',root||document).filter(function(el){ return !el.classList.contains('seen'); }); if(!els.length) return;
    if(!('IntersectionObserver' in window)||RM){ els.forEach(see); return; }
    if(!io) io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ see(e.target); io.unobserve(e.target); } }); },{rootMargin:'0px 0px -6% 0px',threshold:0});
    els.forEach(function(el){ io.observe(el); }); }};
})();

/* scroll frame: dark band, glass over dark, tab bar folds away, counter rail */
var FX=(function(){
  var ticking=false, lastY=0;
  function frame(){ ticking=false; var y=scrollY, vh=innerHeight;
    var dark=$q('#c-biz'), side=$q('#side'), pbar=$q('#pbar'), tabbar=$q('#tabbar'), rail=$q('#c-rail');
    if(dark){ var r=dark.getBoundingClientRect(); var e=RM?1:clampN((vh-r.top)/(vh*.7),0,1); dark.style.setProperty('--e',e.toFixed(4)); var mid=vh/2;
      if(rail) rail.classList.toggle('dk',r.top<mid+120&&r.bottom>mid-120); if(side) side.classList.toggle('dk',r.top<vh-60&&r.bottom>60); if(pbar) pbar.classList.toggle('dk',r.top<64&&r.bottom>8); if(tabbar) $qa('.lg',tabbar).forEach(function(g){ g.classList.toggle('dk',r.top<vh-20&&r.bottom>vh-70); }); }
    else { if(side) side.classList.remove('dk'); if(pbar) pbar.classList.remove('dk'); if(tabbar) $qa('.lg',tabbar).forEach(function(g){ g.classList.remove('dk'); }); }
    if(tabbar){ if(y>lastY+6&&y>240) tabbar.classList.add('min'); else if(y<lastY-6&&tabbar.classList.contains('min')){ tabbar.classList.remove('min'); setTimeout(function(){ TB.place(tabbar,false); },640); } }
    lastY=y; if(rail) CMDP.spy(); }
  addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(frame); } },{passive:true});
  addEventListener('resize',function(){ frame(); });
  return {frame:frame};
})();

/* the command page: counter rail and the line of live news */
var CMDP=(function(){
  var SEC=[['c-need','needs you'],['c-nums','numbers'],['c-att','attendance'],['c-flg','flags'],['c-biz','business'],['c-team','team'],['c-cli','clients']];
  var cur=-1, lock=null, tk=null, tkI=0, tkList=[], tkKey='';
  function els(){ return SEC.map(function(s){ return document.getElementById(s[0]); }); }
  function setActive(i){ var rail=$q('#c-rail'); if(!rail) return; $qa('.c-ri',rail).forEach(function(b,k){ b.classList.toggle('on',k===i); b.classList.toggle('past',k<i); }); }
  function spy(){ var rail=$q('#c-rail'); if(!rail) return; var line=phone()?110:innerHeight*.32, list=els(), tops=list.map(function(el){ return el?el.getBoundingClientRect().top-line:1e9; }), idx=0;
    for(var i=0;i<tops.length;i++){ if(tops[i]<=0) idx=i; }
    var end=innerHeight+scrollY>=document.documentElement.scrollHeight-4; if(end) idx=tops.length-1;
    var p=idx; if(idx<tops.length-1){ var a=tops[idx], b=tops[idx+1]; if(b!==a) p=idx+clampN(-a/(b-a),0,1); }
    var fill=$q('.c-rtr i',rail); if(fill) fill.style.transform='scaleY('+(p/(SEC.length-1)).toFixed(4)+')';
    if(lock!==null){ if(lock===idx) lock=null; else return; }
    if(idx!==cur){ cur=idx; setActive(idx); } }
  function go(i){ var el=document.getElementById(SEC[i][0]); if(!el) return; lock=i; cur=i; setActive(i); glideTo(el,function(){ lock=null; MK.lookAt(el,1200); }); }
  function tick(){ if(!tk||!tk.isConnected){ stopT(); return; } if(document.hidden) return; if(tkList.length<2) return; tkI=(tkI+1)%tkList.length; swap(tkList[tkI]); }
  var tkT=null; function stopT(){ clearInterval(tkT); tkT=null; }
  function swap(text){ if(!tk) return; var old=$qa('span',tk); var s=document.createElement('span'); s.className='dn'; s.textContent=text; tk.appendChild(s); s.getBoundingClientRect(); s.className=''; old.forEach(function(o){ o.className='up'; setTimeout(function(){ if(o.parentNode) o.parentNode.removeChild(o); },700); }); }
  return {
    sec:SEC,
    mount:function(){ cur=-1; lock=null; setTimeout(function(){ spy(); FX.frame(); },60); },
    go:go, spy:spy,
    ticker:function(el,list){ tk=el; if(!tk) return; var key=list.join('|'); if(key===tkKey && $q('span',tk)) return; tkKey=key; tkList=list.length?list:['Quiet so far today']; tkI=0; if(!$q('span',tk)){ var s=document.createElement('span'); s.textContent=tkList[0]; tk.appendChild(s); } else swap(tkList[0]); stopT(); tkT=setInterval(tick,5200); },
    unmount:function(){ stopT(); tk=null; tkKey=''; }
  };
})();

/* the pointer lights the edge of whatever card it is on */
(function(){ var raf=0, last=null; document.addEventListener('pointermove',function(e){ last=e; if(raf) return; raf=requestAnimationFrame(function(){ raf=0; var t=last.target; var c=t&&t.closest&&t.closest('.card,.c-band.dark'); if(!c) return; var r=c.getBoundingClientRect(); c.style.setProperty('--mx',(last.clientX-r.left)+'px'); c.style.setProperty('--my',(last.clientY-r.top)+'px'); }); },{passive:true}); })();

/* swipe a needs card on touch: right says yes, left says no */
function bindSwipe(w,c,done){
  var x0=0,y0=0,dx=0,on=false,lock=0,id=null,Wd=0;
  function down(e){ if(e.pointerType!=='touch'||(e.target.closest&&e.target.closest('.c-acts button'))) return; x0=e.clientX; y0=e.clientY; dx=0; lock=0; on=true; id=e.pointerId; Wd=c.offsetWidth; }
  function move(e){ if(!on||e.pointerId!==id) return; var mx=e.clientX-x0, my=e.clientY-y0;
    if(!lock){ if(Math.abs(mx)>8&&Math.abs(mx)>Math.abs(my)){ lock=1; try{ c.setPointerCapture(id); }catch(err){} c.classList.add('drag'); } else if(Math.abs(my)>10){ on=false; return; } else return; }
    dx=mx; c.style.translate=dx+'px 0'; w.classList.toggle('sl',dx>0); w.classList.toggle('sr',dx<0);
    var arm=Math.abs(dx)>Wd*.32; if(arm!==w.classList.contains('arm')){ w.classList.toggle('arm',arm); if(arm&&navigator.vibrate){ try{ navigator.vibrate(8); }catch(err){} } } }
  function up(e){ if(!on||e.pointerId!==id) return; on=false; c.classList.remove('drag'); if(!lock) return; var arm=Math.abs(dx)>Wd*.32;
    if(arm){ c.style.translate=(dx>0?Wd+40:-Wd-40)+'px 0'; done(dx>0?1:-1); } else { c.style.translate=''; w.classList.remove('sl','sr','arm'); } }
  c.addEventListener('pointerdown',down); c.addEventListener('pointermove',move); c.addEventListener('pointerup',up); c.addEventListener('pointercancel',up);
  return function(){ c.removeEventListener('pointerdown',down); c.removeEventListener('pointermove',move); c.removeEventListener('pointerup',up); c.removeEventListener('pointercancel',up); };
}
