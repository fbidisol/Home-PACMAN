import {Game, THEMES, HOME, CLOCK, ease, clamp} from './engine.mjs';
import {clockPolygons, smoothHover} from './visuals.mjs';
import {RoundSound} from './audio.mjs';

// ART is embedded by build.py. All imagery is drawn from paths and circles.
const canvas=document.querySelector('#game');
const announcer=document.querySelector('#announcement');
const startButton=document.querySelector('#start');
const soundButton=document.querySelector('#sound');
const resumeButton=document.querySelector('#resume');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const game=new Game(ART.foods);
const oPath=new Path2D(ART.oPath);
const letterPath=new Path2D(ART.letterPath);
const stage=document.createElement('canvas');
const ctx=stage.getContext('2d',{alpha:false});
const letters=document.createElement('canvas');
letters.width=3800;letters.height=1600;
const lc=letters.getContext('2d');
const pointer={x:-1000,y:-1000,vx:0,vy:0,inside:false};
const particles=[];
const keys=new Set();
let view={scale:1,x:0,y:0,width:1900,height:800,dpr:1};
let paused=false,last=0,clockValue=-1,now=0,biteDrawn=0,cacheTheme=-1,hoverInfluence=0;
let soundOn=true;
const hover={vx:0,vy:0,lastX:0,lastY:0,initialized:false};
let paintDt=1/60;
let gl,glProgram,uniforms,texture,fallback;

function announce(text){announcer.textContent=text;}
function seed(n){return Math.sin(n*127.1+39.7)*.5+.5;}

const sound=new RoundSound({
  element:document.querySelector('#music'),urls:ART.audioUrls||[],encoded:ART.audios||[],
  clock:()=>({state:game.state,elapsed:game.elapsed,paused,muted:!soundOn}),
  onstatus:value=>{
    soundButton.textContent=value==='blocked'&&soundOn?'ACTIVAR SONIDO':soundOn?'SONIDO ON':'SONIDO OFF';
    soundButton.dataset.status=value;
    if(value==='blocked')announce('Toca Activar sonido para permitir la música. La partida sigue activa.');
  },
});

function initWebGL(){
  try{
    if(matchMedia('(pointer: coarse)').matches)throw new Error('Touch renderer uses Canvas 2D');
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl)throw new Error('WebGL unavailable');
    const vert='attribute vec2 a; varying vec2 uv; void main(){uv=(a+1.0)*0.5;gl_Position=vec4(a,0.0,1.0);}';
    const frag=`precision highp float;
      varying vec2 uv;uniform sampler2D image;uniform vec2 cursor;uniform vec2 velocity;
      uniform vec2 resolution;uniform float influence;uniform vec3 background;uniform vec3 ink;uniform vec3 echo;
      void main(){
        vec2 p=vec2(uv.x,1.0-uv.y);vec2 delta=(p-cursor)*resolution;
        float speed=length(velocity);float radius=80.0+min(speed*.055,55.0);
        float weight=exp(-dot(delta,delta)/(radius*radius))*influence;
        vec2 shift=velocity*.012*weight;
        vec2 q=p-shift/resolution;
        vec3 base=texture2D(image,clamp(q,vec2(0.0),vec2(1.0))).rgb;
        vec2 trail=p-(shift+velocity*.026*weight)/resolution;
        vec3 ghost=texture2D(image,clamp(trail,vec2(0.0),vec2(1.0))).rgb;
        float contrast=max(length(ink-background),.01);
        float cover=clamp(length(base-background)/contrast,0.0,1.0);
        float ghostCover=clamp(length(ghost-background)/contrast,0.0,1.0);
        float amount=.40*ghostCover*weight*smoothstep(8.0,120.0,speed)*(1.0-cover);
        gl_FragColor=vec4(mix(base,echo,amount),1.0);
      }`;
    const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};
    glProgram=gl.createProgram();gl.attachShader(glProgram,compile(gl.VERTEX_SHADER,vert));gl.attachShader(glProgram,compile(gl.FRAGMENT_SHADER,frag));gl.linkProgram(glProgram);
    if(!gl.getProgramParameter(glProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(glProgram));
    gl.useProgram(glProgram);
    const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const a=gl.getAttribLocation(glProgram,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    uniforms=Object.fromEntries(['image','cursor','velocity','resolution','influence','background','ink','echo'].map(k=>[k,gl.getUniformLocation(glProgram,k)]));
    gl.uniform1i(uniforms.image,0);
  }catch(error){
    canvas.dataset.rendererReason=String(error.message||error);
    // A canvas that has acquired WebGL cannot switch to 2D: use a second canvas.
    gl=null;
    fallback=document.createElement('canvas');fallback.className='fallback';fallback.setAttribute('aria-hidden','true');canvas.before(fallback);
    canvas.classList.add('input-only');
  }
}

function resize(){
  const rect=canvas.getBoundingClientRect();
  const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
  const mobile=width<700;
  const virtualWidth=mobile?1040:1900;
  const scale=Math.min(width/virtualWidth,height/800);
  const dpr=Math.min(window.devicePixelRatio||1,2);
  view={width,height,dpr,scale,x:width/2-(mobile?1015:950)*scale,y:height/2-400*scale};
  stage.width=canvas.width=Math.round(width*dpr);stage.height=canvas.height=Math.round(height*dpr);
  if(fallback){fallback.width=canvas.width;fallback.height=canvas.height;}
  if(gl)gl.viewport(0,0,canvas.width,canvas.height);
  game.bounds=mobile?{left:495,right:1535,top:0,bottom:800}:{left:0,right:1900,top:0,bottom:800};
  startButton.style.left=(view.x+(HOME.x-HOME.radius)*scale)+'px';
  startButton.style.top=(view.y+(HOME.y-HOME.radius)*scale)+'px';
  startButton.style.width=startButton.style.height=(HOME.radius*2*scale)+'px';
}

function originalLetters(c){
  c.save();c.translate(638,303);c.scale(.365,.365);c.translate(-172,-190);c.fill(letterPath,'evenodd');c.restore();
}
function rebuildLetters(){
  lc.setTransform(2,0,0,2,0,0);lc.clearRect(0,0,1900,800);lc.fillStyle=THEMES[game.theme].ink;originalLetters(lc);
  biteDrawn=0;cacheTheme=game.theme;
}
function updateBites(){
  if(cacheTheme!==game.theme||biteDrawn>game.bites.length)rebuildLetters();
  lc.globalCompositeOperation='destination-out';
  for(;biteDrawn<game.bites.length;biteDrawn++){
    const [x,y,r]=game.bites[biteDrawn];lc.beginPath();lc.arc(x,y,r,0,Math.PI*2);lc.fill();
  }
  lc.globalCompositeOperation='source-over';
}
function drawO(c,hero,open,rotation=0){
  c.save();c.translate(hero.x,hero.y);c.rotate(hero.angle+rotation);
  if(open>0){c.beginPath();c.moveTo(0,0);c.arc(0,0,hero.radius*1.24,open,Math.PI*2-open);c.closePath();c.clip();}
  c.scale(hero.radius*2/551,hero.radius*2/551);c.translate(-282,-280);c.fill(oPath,'evenodd');c.restore();
}
function polygon(c,points){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
}
function drawClock(c,value,pulse=1){
  const opacity=c.globalAlpha;
  c.save();c.translate(CLOCK.x+CLOCK.width/2,CLOCK.y+CLOCK.height/2);
  c.scale(pulse,pulse);c.translate(-CLOCK.width/2,-CLOCK.height/2);
  for(const item of clockPolygons(value,true)){
    c.globalAlpha=opacity*(item.active?1:.085);polygon(c,item.points);
  }
  c.globalAlpha=1;c.restore();
}

function drawWhole(c,themeIndex,rotate=true){
  c.fillStyle=THEMES[themeIndex].ink;originalLetters(c);
  drawO(c,{...HOME,radius:HOME.radius*(rotate&&!reduced?1+Math.sin(now*.65)*.006:1),angle:0},0,rotate&&!reduced?now*.16:0);
}
function drawParticles(c){
  for(const p of particles){
    const t=clamp(p.age/p.life,0,1),k=ease(t);
    const tx=game.hero.x,ty=game.hero.y;
    const x=p.x+(tx-p.x)*k+Math.sin(t*Math.PI)*p.dx;
    const y=p.y+(ty-p.y)*k+Math.sin(t*Math.PI)*p.dy;
    c.globalAlpha=1-t;c.beginPath();c.arc(x,y,p.r*(1-t*.7),0,Math.PI*2);c.fill();
  }c.globalAlpha=1;
}
function explosion(c){
  const t=game.stateTime;
  if(t<.30){
    c.fillStyle=THEMES[game.theme].ink;
    drawO(c,{...game.hero,radius:game.hero.radius*(1-ease(t/.3)*.76)},0);
    // The illuminated seven-segment bars are swallowed as the final food.
    const k=ease(t/.30);
    c.fillStyle=THEMES[game.theme].timer;c.globalAlpha=1-k;
    for(const item of clockPolygons(game.seconds)){
      polygon(c,item.points.map(([x,y])=>{
        const ox=CLOCK.x+x,oy=CLOCK.y+y;
        return [ox+(game.hero.x-ox)*k,oy+(game.hero.y-oy)*k];
      }));
    }
    c.globalAlpha=1;
    return;
  }
  const p=ease((t-.30)/1.85),o=game.winOrigin;
  const left=-view.x/view.scale,right=(view.width-view.x)/view.scale;
  const top=-view.y/view.scale,bottom=(view.height-view.y)/view.scale;
  const farthest=Math.max(...[[left,top],[right,top],[left,bottom],[right,bottom]].map(([x,y])=>Math.hypot(x-o.x,y-o.y)));
  const radius=p*(farthest+320);
  if(!reduced&&p<.8){
    c.fillStyle=THEMES[game.theme].ink;c.globalAlpha=(1-p)*.75;
    for(let i=0;i<54;i++){
      const a=i*Math.PI*2/54,d=radius*(1.08+seed(i)*.17),r=(2+seed(i+40)*6)*(1-p);
      c.beginPath();c.arc(o.x+Math.cos(a)*d,o.y+Math.sin(a)*d,r,0,Math.PI*2);c.fill();
    }c.globalAlpha=1;
  }
  c.save();c.beginPath();c.arc(o.x,o.y,radius*.9+1,0,Math.PI*2);
  if(!reduced){
    // Monotonically expanding circles: the revealed scene never closes again.
    for(let i=0;i<76;i++){
      const a=i*Math.PI*2/76;
      const d=radius*(.80+.09*seed(i));const r=radius*(.07+.065*seed(i+80));
      const x=o.x+Math.cos(a)*d,y=o.y+Math.sin(a)*d;
      c.moveTo(x+r,y);c.arc(x,y,r,0,Math.PI*2);
    }
  }
  c.clip();const next=(game.theme+1)%3;
  c.fillStyle=THEMES[next].background;c.fillRect(-4000,-4000,10000,10000);
  drawWhole(c,next,false);c.restore();
}
function paint(){
  const theme=THEMES[game.theme];
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=theme.background;ctx.fillRect(0,0,stage.width,stage.height);
  ctx.setTransform(view.dpr*view.scale,0,0,view.dpr*view.scale,view.dpr*view.x,view.dpr*view.y);
  ctx.fillStyle=theme.ink;
  if(game.state==='idle')drawWhole(ctx,game.theme);
  else if(game.state==='playing'){
    updateBites();
    if(!game.cleared)ctx.drawImage(letters,0,0,1900,800);
    drawO(ctx,game.hero,.12+(.5+.5*Math.sin(now*19))*.49);
    drawParticles(ctx);
    ctx.fillStyle=theme.timer;
    const pulse=game.cleared&&!reduced?1+Math.sin(now*8)*.045:1;
    drawClock(ctx,game.seconds,pulse);
    if(game.cleared){
      ctx.globalAlpha=.48;ctx.lineWidth=1.6;ctx.setLineDash([3,8]);
      ctx.beginPath();ctx.roundRect(CLOCK.x-12,CLOCK.y-10,CLOCK.width+20,CLOCK.height+12,18);ctx.strokeStyle=theme.timer;ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    }
    // A restrained pointer marker keeps the destination visible during play.
    if(pointer.inside){ctx.globalAlpha=.5;ctx.beginPath();ctx.arc(game.target.x,game.target.y,4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  }else if(game.state==='returning'){
    updateBites();ctx.globalAlpha=1-ease(game.stateTime/1.15);ctx.drawImage(letters,0,0,1900,800);
    ctx.globalAlpha=ease(game.stateTime/1.15);originalLetters(ctx);ctx.globalAlpha=1;
    drawO(ctx,game.hero,0);
    if(game.lastResult==='timeout'){ctx.fillStyle=theme.timer;ctx.globalAlpha=1-ease(game.stateTime/1.15);drawClock(ctx,0);ctx.globalAlpha=1;}
  }else if(game.state==='winning')explosion(ctx);
  ctx.setTransform(1,0,0,1,0,0);
  if(gl){
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,stage);
    const inLogo=pointer.inside&&pointer.x>630&&pointer.x<1266&&pointer.y>295&&pointer.y<510;
    gl.uniform2f(uniforms.cursor,(view.x+pointer.x*view.scale)/view.width,(view.y+pointer.y*view.scale)/view.height);
    gl.uniform2f(uniforms.velocity,hover.vx*view.scale,hover.vy*view.scale);
    gl.uniform2f(uniforms.resolution,view.width,view.height);
    hoverInfluence+=((game.state==='idle'&&inLogo&&!reduced?1:0)-hoverInfluence)*(1-Math.exp(-paintDt*9));
    gl.uniform1f(uniforms.influence,hoverInfluence);
    const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    gl.uniform3fv(uniforms.background,rgb(theme.background));
    gl.uniform3fv(uniforms.ink,rgb(theme.ink));
    gl.uniform3fv(uniforms.echo,rgb(theme.timer));
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }else{fallback.getContext('2d').drawImage(stage,0,0);}
}

function processEvents(){
  for(const e of game.drain()){
    if(e.type==='start'){
      rebuildLetters();particles.length=0;sound.start(e.theme);startButton.hidden=true;
      canvas.style.touchAction='none';announce('Tienes veinte segundos. Come las letras y después el reloj.');
    }else if(e.type==='bite'){
      if(!reduced){const step=Math.max(1,Math.floor(e.indices.length/18));
        for(let j=0;j<e.indices.length;j+=step){const xy=ART.foods[e.indices[j]];particles.push({x:xy[0],y:xy[1],r:1.8+seed(j)*3,age:0,life:.25+seed(j+50)*.18,dx:(seed(j+100)-.5)*40,dy:(seed(j+150)-.5)*40});}
        if(particles.length>220)particles.splice(0,particles.length-220);
      }
    }else if(e.type==='clock-unlocked')announce('Letras completas. ¡Cómete el reloj!');
    else if(e.type==='win'){
      sound.stop(1.9);announce('¡Ganaste! Nuevo color.');
    }else if(e.type==='lose'){
      sound.stop(.12);
      announce(e.reason==='timeout'?'Se acabó el tiempo. Puedes intentarlo otra vez.':'Intento cancelado.');
    }else if(e.type==='ready'||e.type==='next'){
      rebuildLetters();particles.length=0;startButton.hidden=false;
      sound.prepare(game.theme);
      clockValue=-1;canvas.setAttribute('aria-label','Juego IDISOL. Toca la O para empezar.');
      startButton.setAttribute('aria-label','Jugar: veinte segundos para comer IDISOL y el reloj');
      document.documentElement.style.setProperty('--ui',THEMES[game.theme].timer);
      document.body.style.background=THEMES[game.theme].background;
    }
  }
}
function frame(time){
  const raw=last?(time-last)/1000:0;last=time;
  // requestAnimationFrame's monotonic clock governs gameplay. A suspended or
  // blocked audio clock must never freeze movement or the countdown on iOS.
  const dt=paused?0:raw;paintDt=Math.min(raw,.1);
  smoothHover(hover,pointer.x,pointer.y,pointer.inside,paintDt);
  now+=paused?0:Math.min(raw,.1);
  if(!paused){
    if(game.state==='playing'&&keys.size){
      let dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
      let dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
      if(dx||dy)game.point(game.hero.x+dx*180,game.hero.y+dy*180);
    }
    game.step(dt);processEvents();sound.tick(dt);
    for(const p of particles)p.age+=dt;
    for(let i=particles.length-1;i>=0;i--)if(particles[i].age>=particles[i].life)particles.splice(i,1);
  }
  if(game.state==='playing'&&clockValue!==game.seconds){clockValue=game.seconds;canvas.setAttribute('aria-label',`Juego IDISOL. ${clockValue} segundos restantes.`);}
  paint();requestAnimationFrame(frame);
}
function start(){if(paused)return;if(game.start())processEvents();}
function worldPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-view.x)/view.scale,y:(e.clientY-r.top-view.y)/view.scale};}
function movePointer(e){
  const p=worldPoint(e);
  pointer.x=p.x;pointer.y=p.y;pointer.inside=true;
  if(game.state==='playing'&&!paused)game.point(p.x,p.y);
  canvas.style.cursor=game.state==='playing'?'none':Math.hypot(p.x-HOME.x,p.y-HOME.y)<HOME.radius*1.12?'pointer':'default';
}
canvas.addEventListener('pointermove',movePointer);
startButton.addEventListener('pointermove',movePointer);
canvas.addEventListener('pointerdown',e=>{
  const p=worldPoint(e);pointer.x=p.x;pointer.y=p.y;pointer.inside=true;
  if(game.state==='idle'&&Math.hypot(p.x-HOME.x,p.y-HOME.y)<HOME.radius*1.15){start();}
  if(game.state==='playing'){
    game.point(p.x,p.y);
    if(e.pointerType==='touch'){
      try{canvas.setPointerCapture(e.pointerId);}catch{}
      e.preventDefault();
    }
  }
});
canvas.addEventListener('pointerleave',()=>{pointer.inside=false;});
canvas.addEventListener('pointercancel',()=>{pointer.inside=false;});
startButton.addEventListener('click',start);
// Native button activation unlocks media on iPhone. Touch Events also cover
// embedded webviews that cancel or omit Pointer Events during a drag.
canvas.addEventListener('click',e=>{
  const p=worldPoint(e);
  if(game.state==='idle'&&Math.hypot(p.x-HOME.x,p.y-HOME.y)<HOME.radius*1.15)start();
  else if(game.state==='playing')sound.ensurePlaying();
});
canvas.addEventListener('touchstart',e=>{
  const t=e.touches[0];if(!t)return;const p=worldPoint(t);
  if(game.state==='idle'&&Math.hypot(p.x-HOME.x,p.y-HOME.y)<HOME.radius*1.15)start();
  if(game.state==='playing'){
    game.point(p.x,p.y);pointer.inside=true;
    pointer.x=p.x;pointer.y=p.y;e.preventDefault();
  }
},{passive:false});
canvas.addEventListener('touchmove',e=>{
  if(game.state!=='playing'||paused)return;
  const t=e.touches[0];if(!t)return;const p=worldPoint(t);
  pointer.x=p.x;pointer.y=p.y;pointer.inside=true;game.point(p.x,p.y);e.preventDefault();
},{passive:false});
canvas.addEventListener('touchend',()=>{if(game.state==='playing')sound.ensurePlaying();});
window.addEventListener('keydown',e=>{
  const arrows=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'];
  if(arrows.includes(e.key)&&game.state==='playing'){e.preventDefault();keys.add(e.key);}
  if(e.key==='Escape'&&game.state==='playing'){game.lose('cancel');processEvents();}
});
window.addEventListener('keyup',e=>keys.delete(e.key));
window.addEventListener('blur',()=>keys.clear());
soundButton.addEventListener('click',()=>{
  if(sound.blocked&&soundOn){sound.ensurePlaying();return;}
  soundOn=!soundOn;sound.mute();soundButton.setAttribute('aria-pressed',String(!soundOn));
  if(soundOn)sound.ensurePlaying();
});
function pauseGame(){
  if(game.state!=='playing'||paused)return;
  paused=true;keys.clear();sound.pause();resumeButton.hidden=false;announce('Partida en pausa. Pulsa continuar para volver.');
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
resumeButton.addEventListener('click',()=>{
  paused=false;last=performance.now();resumeButton.hidden=true;sound.resume();
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pauseGame();});
canvas.addEventListener('webglcontextrestored',()=>{initWebGL();resize();});
initWebGL();resize();rebuildLetters();
new ResizeObserver(resize).observe(document.querySelector('main'));
// Audio preparation is best-effort and never gates the start button.
startButton.disabled=false;
sound.load().catch(()=>{});
announce('Listo. Toca la O para jugar.');
requestAnimationFrame(frame);
