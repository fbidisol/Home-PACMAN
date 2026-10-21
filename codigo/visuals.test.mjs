import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clockPolygons,smoothHover} from './visuals.mjs';
import {CLOCK,HOME} from './engine.mjs';
test('01–20 and 00 use two fixed seven-segment cells in the reference proportions',()=>{
  for(let n=0;n<=20;n++){
    const polygons=clockPolygons(n,true);assert.equal(polygons.length,14);assert(polygons.some(p=>p.active));
    for(const p of polygons)for(const [x,y] of p.points){assert(x>=0&&x<=94);assert(y>=0&&y<=80);}
  }
  assert.equal(CLOCK.width,94);assert.equal(CLOCK.height,80);
  assert(CLOCK.height/(HOME.radius*2)<.41);assert.equal(CLOCK.y,300);assert.equal(clockPolygons(11).length,4);
});
test('hover settles smoothly to zero without oscillating at a stationary cursor',()=>{
  const s={vx:0,vy:0,lastX:0,lastY:0,initialized:false};
  smoothHover(s,100,100,true,1/60);assert.equal(s.vx,0);
  for(let i=1;i<=12;i++)smoothHover(s,100+i*10,100,true,1/60);
  assert(s.vx>100&&s.vx<=950);let previous=s.vx;
  for(let i=0;i<90;i++){smoothHover(s,220,100,true,1/60);assert(s.vx>=0&&s.vx<=previous);previous=s.vx;}
  assert(s.vx<.001);assert.equal(s.vy,0);
});
