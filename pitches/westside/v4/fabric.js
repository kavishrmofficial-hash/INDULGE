/* Fabric engine (from the v3 deck): textiles drawn procedurally, then lit and draped with a WebGL shader
   so they read as photographed cloth. One shared GL canvas renders every frame; targets are 2D canvases. */
const Fabric=(function(){
'use strict';
let FLAT=false;
/* ---------- seeded random ---------- */
function rng(seed){let a=(seed*2654435761)>>>0||1;return function(){a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- textiles: procedural Indian and western fabrics, drawn as the page's imagery ---------- */
let NOISE=null;
function noiseTile(){if(NOISE)return NOISE;const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');const d=x.createImageData(160,160);const r=rng(99);for(let i=0;i<d.data.length;i+=4){const v=r()*255|0;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=r()*44|0}x.putImageData(d,0,0);NOISE=c;return c}
function grain(c,w,h,a){if(FLAT)a*=.45;c.save();c.globalAlpha=a;c.fillStyle=c.createPattern(noiseTile(),'repeat');c.fillRect(0,0,w,h);c.restore()}
function sheen(c,w,h,s){if(FLAT)return;const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(255,255,255,'+(.1*s)+')');g.addColorStop(.45,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,'+(.22*s)+')');c.fillStyle=g;c.fillRect(0,0,w,h);const v=c.createRadialGradient(w*.5,h*.45,Math.min(w,h)*.2,w*.5,h*.5,Math.max(w,h)*.75);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,'+(.28*s)+')');c.fillStyle=v;c.fillRect(0,0,w,h)}
function folds(c,w,h,r,col){for(let i=0;i<5;i++){const x=r()*w,wd=w*(.15+r()*.25);c.save();c.translate(x,0);c.rotate(.18+(r()-.5)*.2);const g=c.createLinearGradient(-wd,0,wd,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,col);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(-wd,-h,wd*2,h*3);c.restore()}}
function blob(c,x,y,rad,col){const g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-rad,y-rad,rad*2,rad*2)}
const TX={
  chikankari(c,w,h,r){c.fillStyle='#f6f3ec';c.fillRect(0,0,w,h);c.strokeStyle='rgba(150,140,120,.5)';c.lineWidth=1;const st=70;for(let x=-st/2;x<w+st;x+=st){const ph=r()*6;c.beginPath();c.moveTo(x,0);for(let y=0;y<=h;y+=10)c.lineTo(x+Math.sin(y/28+ph)*12,y);c.stroke();for(let y=14;y<h;y+=34){const vx=x+Math.sin(y/28+ph)*12,sd=(Math.floor(y/34)%2)?1:-1;c.save();c.translate(vx,y);c.rotate(sd*.9);c.beginPath();c.ellipse(sd*9,0,9,3.6,0,0,7);c.stroke();c.restore();if(r()<.5){const fx=vx-sd*20,fy=y+10;for(let p=0;p<5;p++){const a=p/5*Math.PI*2;c.beginPath();c.ellipse(fx+Math.cos(a)*4,fy+Math.sin(a)*4,3.2,1.8,a,0,7);c.stroke()}c.fillStyle='rgba(170,160,140,.6)';c.beginPath();c.arc(fx,fy,1.2,0,7);c.fill()}}}c.fillStyle='rgba(160,150,130,.35)';const n=Math.min(1600,w*h/220);for(let i=0;i<n;i++){c.beginPath();c.arc(r()*w,r()*h,.7,0,7);c.fill()}const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(0,0,0,.05)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.07)');c.fillStyle=g;c.fillRect(0,0,w,h);grain(c,w,h,.3)},
  denim(c,w,h,r){c.fillStyle='#24385e';c.fillRect(0,0,w,h);c.lineWidth=1;let k=0;for(let x=-h;x<w;x+=2.4,k++){c.strokeStyle=k%2?'rgba(70,98,150,.55)':'rgba(15,26,48,.5)';c.beginPath();c.moveTo(x,0);c.lineTo(x+h,h);c.stroke()}for(let i=0;i<w/3;i++){const x=r()*w;c.strokeStyle='rgba(170,190,225,'+(.03+r()*.06)+')';c.beginPath();c.moveTo(x,0);c.lineTo(x+(r()-.5)*6,h);c.stroke()}blob(c,w*.55,h*.4,Math.max(w,h)*.6,'rgba(140,165,210,.22)');sheen(c,w,h,.8);grain(c,w,h,.6)},
  pinstripe(c,w,h,r){c.fillStyle='#1c2230';c.fillRect(0,0,w,h);c.strokeStyle='rgba(255,255,255,.03)';for(let x=-h;x<w;x+=2){c.beginPath();c.moveTo(x,0);c.lineTo(x+h*.5,h);c.stroke()}c.strokeStyle='rgba(225,225,230,.32)';c.lineWidth=1;for(let x=6;x<w;x+=14){c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,h);c.stroke()}folds(c,w,h,r,'rgba(255,255,255,.04)');sheen(c,w,h,1);grain(c,w,h,.6)},
  rani(c,w,h,r){const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#c0226a');g.addColorStop(1,'#6e0d3b');c.fillStyle=g;c.fillRect(0,0,w,h);folds(c,w,h,r,'rgba(255,170,210,.22)');folds(c,w,h,r,'rgba(40,0,20,.25)');sheen(c,w,h,1);grain(c,w,h,.5)},
  linen(c,w,h,r){c.fillStyle='#d9cdb6';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=2){c.fillStyle='rgba('+(r()<.5?'255,255,255':'90,70,40')+','+(.04+r()*.06)+')';c.fillRect(0,y,w,1)}for(let x=0;x<w;x+=2){c.fillStyle='rgba('+(r()<.5?'255,255,255':'90,70,40')+','+(.03+r()*.05)+')';c.fillRect(x,0,1,h)}c.fillStyle='rgba(120,95,60,.12)';for(let i=0;i<h/6;i++)c.fillRect(r()*w,r()*h,20+r()*60,1);sheen(c,w,h,.4);grain(c,w,h,.5)},
  ink(c,w,h,r){c.fillStyle='#101010';c.fillRect(0,0,w,h);folds(c,w,h,r,'rgba(255,255,255,.05)');sheen(c,w,h,1);grain(c,w,h,.8)}
};

const PRESET={
  rani:{fold:.16,gloss:.5,shine:48,dir:[.8,.35]},
  chikankari:{fold:.09,gloss:.07,shine:14,dir:[.85,-.3]},
  linen:{fold:.09,gloss:.04,shine:10,dir:[.7,.5]}, denim:{fold:.06,gloss:.05,shine:12,dir:[.9,.1]},
  pinstripe:{fold:.07,gloss:.12,shine:22,dir:[.95,.05]}, ink:{fold:.14,gloss:.35,shine:36,dir:[.8,.3]}
};

const PLAIN={slate:['#5d6872','#3c454d'],moss:['#5f6b48','#3d4630'],sand:['#c9b79a','#a8946f'],ivory:['#efe9dc','#d9d0bd'],kohl:['#24221f','#121110'],mehendi:['#5e7a2e','#3e521c'],midnight:['#1d2340','#0d1126'],shaadi:['#9e1b26','#6a0f16'],bone:['#e6dfd1','#cbbfa8'],khaki:['#a89a74','#7e7253'],indigo:['#2c3a68','#1a2348']};
Object.keys(PLAIN).forEach(k=>{TX[k]=function(c,w,h,r){const [a,b]=PLAIN[k];const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(0,0,w,h);for(let y=0;y<h;y+=2){c.fillStyle='rgba(255,255,255,'+(r()*.025)+')';c.fillRect(0,y,w,1)}grain(c,w,h,.35)}});
TX.curtain=function(c,w,h,r){c.fillStyle='#ece5d6';c.fillRect(0,0,w,h);for(let x=0;x<w;x+=2){c.fillStyle='rgba('+(r()<.5?'255,255,255':'120,100,70')+','+(.03+r()*.04)+')';c.fillRect(x,0,1,h)}grain(c,w,h,.3)};
Object.assign(PRESET,{slate:{fold:.15,gloss:.32,shine:34,dir:[.8,.35]},moss:{fold:.13,gloss:.2,shine:26,dir:[.7,.5]},sand:{fold:.12,gloss:.16,shine:22,dir:[.85,-.3]},ivory:{fold:.12,gloss:.18,shine:24,dir:[.8,.3]},kohl:{fold:.15,gloss:.35,shine:40,dir:[.8,.3]},mehendi:{fold:.14,gloss:.28,shine:30,dir:[1,.05]},midnight:{fold:.14,gloss:.4,shine:40,dir:[1,.05]},shaadi:{fold:.14,gloss:.42,shine:40,dir:[1,.05]},bone:{fold:.1,gloss:.06,shine:12,dir:[.9,.3]},khaki:{fold:.1,gloss:.06,shine:12,dir:[.9,.3]},indigo:{fold:.1,gloss:.1,shine:16,dir:[.9,.3]},curtain:{fold:.2,gloss:.08,shine:14,dir:[1,0]}});
const VS='attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
const FS=`precision highp float;
uniform sampler2D T;uniform vec2 R;uniform float tm,sd,fold,gloss,shine;uniform vec2 dir;varying vec2 v;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float H(vec2 p){vec2 d=normalize(dir);vec2 q=vec2(dot(p,d),dot(p,vec2(-d.y,d.x)));float t=tm*.12;
 float h=sin(q.x*6.5+1.7*sin(q.y*2.1+sd)+t)*.55;
 h+=sin(q.x*12.5+2.2*sin(q.y*3.3+sd*1.7)-t*1.3)*.2;
 h+=sin((q.x+q.y)*3.4+sd*2.3+t*.6)*.38;
 h+=(ns(p*2.6+sd)-.5)*.4;return h;}
void main(){vec2 as=vec2(R.x/R.y,1.);vec2 p=v*as;float e=1.5/R.y;
 float h=H(p);float dx=(H(p+vec2(e,0.))-H(p-vec2(e,0.)))/(2.*e);float dy=(H(p+vec2(0.,e))-H(p-vec2(0.,e)))/(2.*e);
 vec3 n=normalize(vec3(-dx*fold,-dy*fold,1.));
 vec2 uv=v+n.xy*.018+vec2(0.,h*.006);
 vec3 al=texture2D(T,uv).rgb;
 vec3 L=normalize(vec3(-.55,.62,.62));float df=max(dot(n,L),0.);
 vec3 Hv=normalize(L+vec3(0.,0.,1.));float sp=pow(max(dot(n,Hv),0.),shine)*gloss;
 float ao=.7+.3*smoothstep(-1.3,1.3,h);
 vec3 c=al*(.32+.86*df)*ao+sp*vec3(1.,.97,.92);
 c*=1.-.32*pow(length(v-.5)*1.3,2.);
 c+=(hs(v*R+tm)-.5)*.025;
 gl_FragColor=vec4(c,1.);}`;
let gl=null,glc=null,prog=null,U={},tex=null,ok=null;
function initGL(){if(ok!==null)return ok;try{glc=document.createElement('canvas');gl=glc.getContext('webgl',{preserveDrawingBuffer:true,antialias:false,premultipliedAlpha:false});if(!gl)return ok=false;
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
 prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('link');gl.useProgram(prog);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
 ['T','R','tm','sd','fold','gloss','shine','dir'].forEach(k=>U[k]=gl.getUniformLocation(prog,k));
 tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 return ok=true}catch(e){return ok=false}}
function pattern(kind,seed,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');FLAT=true;try{(TX[kind]||TX.ink)(x,w,h,rng(seed))}finally{FLAT=false}return c}
const cache=new WeakMap();
/* draw(target, kind, seed, t): renders lit cloth into a 2D canvas sized to its CSS box */
function draw(cv,kind,seed,t,force){const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return false;const dpr=Math.min(2,window.devicePixelRatio||1);
 let W=Math.round(w*dpr),Hh=Math.round(h*dpr);const m=Math.max(W,Hh);if(m>1800){const s=1800/m;W=Math.round(W*s);Hh=Math.round(Hh*s)}
 const st=cache.get(cv);const same=st&&st.W===W&&st.H===Hh&&st.k===kind&&st.s===seed;
 if(same&&!force&&t===undefined)return true;
 const ctx=cv.getContext('2d');if(cv.width!==W||cv.height!==Hh){cv.width=W;cv.height=Hh}
 // pattern is drawn at CSS-pixel scale so motif sizes stay consistent across devices
 const pat=same?st.pat:(()=>{const pw=Math.round(W/ (W/w>1.01?W/w:1)),ph=Math.round(Hh/(Hh/h>1.01?Hh/h:1));const c=document.createElement('canvas');c.width=W;c.height=Hh;const x=c.getContext('2d');x.scale(W/w,Hh/h);FLAT=true;try{(TX[kind]||TX.ink)(x,w,h,rng(seed))}finally{FLAT=false}return c})();
 cache.set(cv,{W,H:Hh,k:kind,s:seed,pat});
 if(!initGL()){ctx.drawImage(pat,0,0);return true}
 glc.width=W;glc.height=Hh;gl.viewport(0,0,W,Hh);gl.bindTexture(gl.TEXTURE_2D,tex);
 if(!same||!st.up){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,pat)}
 const P=PRESET[kind]||PRESET.ink;gl.uniform1i(U.T,0);gl.uniform2f(U.R,W,Hh);gl.uniform1f(U.tm,t||0);gl.uniform1f(U.sd,(seed%97)*.37);gl.uniform1f(U.fold,P.fold);gl.uniform1f(U.gloss,P.gloss);gl.uniform1f(U.shine,P.shine);gl.uniform2f(U.dir,P.dir[0],P.dir[1]);
 gl.drawArrays(gl.TRIANGLE_STRIP,0,4);ctx.drawImage(glc,0,0);return true}
return {draw,TX,rng,flat:pattern};
})();
