import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game, HOME, CLOCK} from './engine.mjs';
const art=JSON.parse(readFileSync(new URL('./art.json',import.meta.url)));
const create=()=>new Game(art.foods);
function move(g,x,y){
  g.point(x,y);let frames=0;
  while(g.state==='playing'&&Math.hypot(g.hero.x-g.target.x,g.hero.y-g.target.y)>2&&frames++<2500)g.step(.01);
  g.step(.05);
}
function play(g){
  g.start();
  for(let row=0;row<4;row++){
    const y=310+row*60;
    move(g,row%2?1320:580,y);
    move(g,row%2?580:1320,y);
  }
  // Seek any sizeable remaining letter fragment using the front of the mouth.
  let attempts=0;
  while(g.state==='playing'&&!g.cleared&&attempts++<25){
    const index=g.alive.findIndex(v=>v===1);const [x,y]=g.food[index];
    const dx=x-g.hero.x,dy=y-g.hero.y,d=Math.hypot(dx,dy)||1;
    move(g,x+dx/d*65,y+dy/d*65);
  }
  if(g.state==='playing')move(g,CLOCK.x+CLOCK.width/2,CLOCK.y+CLOCK.height/2);
}
test('a single gesture starts a 20-second round; repeated start does not reset it',()=>{
  const g=create();assert(g.start());g.step(1);assert.equal(g.seconds,19);
  assert.equal(g.start(),false);assert.equal(g.elapsed,1);assert.equal(g.theme,0);
});
test('the timer cannot be eaten while any letters remain',()=>{
  const g=create();g.start();move(g,CLOCK.x+CLOCK.width/2,CLOCK.y+60);
  assert(g.remaining>0);assert.equal(g.state,'playing');assert.equal(g.win(),false);
});
test('timeout returns to the exact original logo, same colour and retryable state',()=>{
  const g=create();g.start();g.step(20);
  assert.equal(g.state,'returning');assert.equal(g.theme,0);assert.equal(g.seconds,0);
  g.step(1.2);assert.equal(g.state,'idle');assert.equal(g.hero.x,HOME.x);
  assert.equal(g.remaining,art.foods.length);assert.equal(g.bites.length,0);assert(g.start());
});
test('all three rounds can be won with a realistic sweep and close the colour loop',()=>{
  const g=create();const times=[];
  for(let n=0;n<3;n++){
    play(g);times.push(g.elapsed);
    assert.equal(g.state,'winning',`round ${n}: ${g.remaining} samples remain at ${g.elapsed}s`);
    assert(g.elapsed<20);assert.equal(g.remaining,0);
    const theme=g.theme;g.step(1);assert.equal(g.theme,theme);
    g.step(1.2);assert.equal(g.state,'idle');assert.equal(g.theme,(theme+1)%3);
  }
  assert.equal(g.theme,0);console.log('Sweep wins at',times.map(t=>t.toFixed(2)).join(', '),'seconds');
});
test('at the 20-second boundary, timeout has priority over a last bite',()=>{
  const g=create();g.start();g.elapsed=19.999;g.remaining=0;
  g.hero.x=CLOCK.x+50;g.hero.y=CLOCK.y+50;g.step(.002);
  assert.equal(g.state,'returning');assert.equal(g.lastResult,'timeout');
});
test('eaten letter samples do not reappear or count twice',()=>{
  const g=create();g.start();move(g,650,380);
  assert(g.remaining<art.foods.length);const first=g.remaining;
  g.step(.2);assert(g.remaining<=first);const second=g.remaining;
  g.step(.2);assert.equal(g.remaining,second);
  assert.equal(g.remaining,g.alive.reduce((a,b)=>a+b,0));
});
