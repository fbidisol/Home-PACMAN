// Deterministic game rules in the 1900 × 800 reference coordinate system.
export const ROUND_SECONDS = 20;
export const THEMES = [
  { background: '#ffffff', ink: '#ed4133', timer: '#000000' },
  { background: '#ed4133', ink: '#000000', timer: '#ffffff' },
  { background: '#000000', ink: '#ffffff', timer: '#ed4133' },
];
export const HOME = { x: 1066.875, y: 403.625, radius: 100.5 };
export const CLOCK = { x: 1274, y: 300, width: 94, height: 80 };
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const ease = t => {t=clamp(t,0,1);return t*t*(3-2*t);};

export class Game {
  constructor(food) {
    this.food = food;
    this.theme = 0;
    this.state = 'idle';
    this.bounds = {left:0,right:1900,top:0,bottom:800};
    this.hero = {...HOME, angle:0};
    this.target = {...HOME};
    this.elapsed = 0;
    this.stateTime = 0;
    this.alive = new Uint8Array(food.length).fill(1);
    this.remaining = food.length;
    this.bites = [];
    this.events = [];
    this.lastResult = null;
    this.nibble = 0;
  }
  start() {
    if(this.state !== 'idle') return false;
    this.state='playing';this.elapsed=0;this.stateTime=0;this.lastResult=null;
    this.hero={...HOME,angle:Math.PI};this.target={...HOME};
    this.alive.fill(1);this.remaining=this.food.length;this.bites=[];this.nibble=0;
    this.events.push({type:'start',theme:this.theme});return true;
  }
  point(x,y) {
    this.target.x=clamp(x,this.bounds.left+this.hero.radius*.42,this.bounds.right-this.hero.radius*.42);
    this.target.y=clamp(y,this.bounds.top+this.hero.radius*.42,this.bounds.bottom-this.hero.radius*.42);
  }
  get seconds() {return Math.max(0,Math.ceil(ROUND_SECONDS-this.elapsed));}
  get cleared() {return this.remaining===0;}
  get progress() {return 1-this.remaining/this.food.length;}
  get muzzle() {
    return {x:this.hero.x+Math.cos(this.hero.angle)*this.hero.radius*.49,
      y:this.hero.y+Math.sin(this.hero.angle)*this.hero.radius*.49,radius:this.hero.radius*.47};
  }
  lose(reason='timeout') {
    if(this.state!=='playing')return;
    this.state='returning';this.stateTime=0;this.returnFrom={...this.hero};this.lastResult=reason;
    this.events.push({type:'lose',reason});
  }
  win() {
    if(this.state!=='playing'||!this.cleared||this.elapsed>=ROUND_SECONDS)return false;
    this.state='winning';this.stateTime=0;this.winOrigin={...this.hero};this.savedTime=ROUND_SECONDS-this.elapsed;
    this.lastResult='win';this.events.push({type:'win',remaining:this.savedTime});return true;
  }
  step(dt) {
    dt=Math.max(0,dt);
    if(this.state==='playing') {
      this.elapsed=Math.min(ROUND_SECONDS,this.elapsed+dt);
      if(this.elapsed>=ROUND_SECONDS){this.lose();return;}
      // Substeps sweep the mouth through the path, avoiding missed collisions on slow frames.
      const count=Math.max(1,Math.ceil(dt/.012));
      for(let n=0;n<count && this.state==='playing';n++)this.moveAndEat(dt/count);
    } else if(this.state==='returning') {
      this.stateTime+=dt;const t=ease(this.stateTime/1.15);
      this.hero.x=this.returnFrom.x+(HOME.x-this.returnFrom.x)*t;
      this.hero.y=this.returnFrom.y+(HOME.y-this.returnFrom.y)*t;
      this.hero.radius=this.returnFrom.radius+(HOME.radius-this.returnFrom.radius)*t;
      this.hero.angle=this.returnFrom.angle*(1-t);
      if(t>=1){this.state='idle';this.hero={...HOME,angle:0};this.bites=[];this.alive.fill(1);this.remaining=this.food.length;this.events.push({type:'ready'});}
    } else if(this.state==='winning') {
      this.stateTime+=dt;
      if(this.stateTime>=2.15){
        this.theme=(this.theme+1)%THEMES.length;this.state='idle';this.hero={...HOME,angle:0};
        this.target={...HOME};this.alive.fill(1);this.remaining=this.food.length;this.bites=[];
        this.events.push({type:'next',theme:this.theme});
      }
    }
  }
  moveAndEat(dt) {
    const dx=this.target.x-this.hero.x,dy=this.target.y-this.hero.y,d=Math.hypot(dx,dy);
    if(d>1.5) {
      const travel=Math.min(d,340*dt);
      const desired=Math.atan2(dy,dx);
      const angleDelta=Math.atan2(Math.sin(desired-this.hero.angle),Math.cos(desired-this.hero.angle));
      this.hero.angle+=angleDelta*Math.min(1,dt*20);
      this.hero.x+=dx/d*travel;this.hero.y+=dy/d*travel;
    }
    this.hero.radius=HOME.radius*(1+this.progress*.12);
    this.nibble+=dt;
    if(this.nibble<.038)return;this.nibble=0;
    const m=this.muzzle;let eaten=[];
    if(!this.cleared){
      for(let i=0;i<this.food.length;i++){
        if(this.alive[i] && (this.food[i][0]-m.x)**2+(this.food[i][1]-m.y)**2<=m.radius**2){
          this.alive[i]=0;this.remaining--;eaten.push(i);
        }
      }
      if(eaten.length){this.bites.push([m.x,m.y,m.radius]);this.events.push({type:'bite',at:[m.x,m.y],indices:eaten});}
      // Only tiny leftovers attract to the mouth. A normal pass still has to eat >98.5%.
      if(this.remaining>0 && this.remaining<=Math.max(8,this.food.length*.015)){
        const rest=[];for(let i=0;i<this.food.length;i++)if(this.alive[i]){this.alive[i]=0;rest.push(i);}
        this.remaining=0;this.events.push({type:'bite',at:[this.hero.x,this.hero.y],indices:rest});
      }
      if(this.cleared)this.events.push({type:'clock-unlocked'});
    }
    if(this.cleared){
      const x=clamp(m.x,CLOCK.x,CLOCK.x+CLOCK.width),y=clamp(m.y,CLOCK.y,CLOCK.y+CLOCK.height);
      if((m.x-x)**2+(m.y-y)**2<(m.radius*.88)**2)this.win();
    }
  }
  drain() {const e=this.events;this.events=[];return e;}
}
