/* REACT reference: every drawer becomes the glass sheet; avatars are initials on ink. */
var GSN=0;
function Drawer(p){
  var s=useState(false); var on=s[0], setOn=s[1]; var ref=useRef(null); var cb=useRef(p.onClose); cb.current=p.onClose; var gone=useRef(false);
  function close(){ if(gone.current) return; gone.current=true; setOn(false); setTimeout(function(){ cb.current(); },300); }
  useEffect(function(){
    var f=function(ev){ if(ev.key==='Escape' && !ISL.isCmd()) close(); }; window.addEventListener('keydown',f);
    GSN++; document.documentElement.classList.add('gs-open');
    var r1=requestAnimationFrame(function(){ requestAnimationFrame(function(){ setOn(true); }); });
    var lt=setTimeout(function(){ if(ref.current) MK.lookAt(ref.current,1200); },260);
    var sh=ref.current, g=sh&&sh.querySelector('.grab'), y0=0, dy=0, drag=false;
    var dn=function(e){ drag=true; y0=e.clientY; dy=0; sh.classList.add('drag'); try{ g.setPointerCapture(e.pointerId); }catch(err){} };
    var mv=function(e){ if(!drag) return; dy=Math.max(0,e.clientY-y0); sh.style.transform='translate3d(0,'+dy+'px,0)'; };
    var up=function(){ if(!drag) return; drag=false; sh.classList.remove('drag'); if(dy>90){ sh.style.transform='translate3d(0,calc(100% + 24px),0)'; close(); } else sh.style.transform=''; };
    if(g){ g.addEventListener('pointerdown',dn); g.addEventListener('pointermove',mv); g.addEventListener('pointerup',up); g.addEventListener('pointercancel',up); }
    return function(){ window.removeEventListener('keydown',f); cancelAnimationFrame(r1); clearTimeout(lt); GSN=Math.max(0,GSN-1); if(!GSN) document.documentElement.classList.remove('gs-open');
      if(g){ g.removeEventListener('pointerdown',dn); g.removeEventListener('pointermove',mv); g.removeEventListener('pointerup',up); g.removeEventListener('pointercancel',up); } };
  },[]);
  return html`<div class="gs-wrap"><div class=${cls('gs-scrim', on&&'on')} onClick=${close}></div>
    <div class=${cls('gs', p.wide&&'wide', on&&'on')} role="dialog" aria-modal="true" aria-label=${p.title} ref=${ref}>
      <div class="grab" aria-hidden="true"></div>
      <div class="gs-h"><h2>${p.title}</h2><button class="shx" type="button" aria-label="Close" onClick=${close}>${I.x}</button></div>
      <div class="gs-in">${p.children}</div></div></div>`;
}

function ini(n){ var w=String(n||'').trim().split(/\s+/).filter(Boolean); if(!w.length) return ''; return (w[0][0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase(); }
function Av(p){ var pr=p.prof||{}; var sz=p.size||32; var st={width:sz+'px',height:sz+'px',fontSize:Math.max(9,Math.round(sz*.36))+'px'};
  if(pr.avatarUrl && /^(data|blob):/.test(pr.avatarUrl)) return html`<img class="av" src=${pr.avatarUrl} alt="" width=${sz} height=${sz} style=${st} />`;
  var t=ini(pr.name); return html`<span class=${cls('av', !t&&'av0')} style=${st} aria-hidden="true">${t}</span>`; }
