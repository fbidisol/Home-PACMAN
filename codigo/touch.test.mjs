import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bootApp} from './test-support.mjs';
test('pending decoding and rejected audio cannot disable the game',async()=>{
 const a=await bootApp({decodePending:true,blocked:true,width:390,height:844});
 assert.equal(a.nodes['#start'].disabled,false);a.nodes['#start'].events.click();a.tick(80);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(a.game.state,'playing');assert.equal(a.game.seconds,19);assert.equal(a.nodes['#resume'].hidden,true);
 assert.match(a.nodes['#sound'].textContent,/ACTIVAR SONIDO/);
 a.nodes['#game'].events.touchmove({touches:[{clientX:90,clientY:420}],preventDefault(){}});
 a.tick(40);assert(a.game.hero.x<1000);
});
test('a suspended AudioContext cannot freeze movement or countdown',async()=>{
 const a=await bootApp({suspended:true,width:390,height:844});a.nodes['#start'].events.click();
 a.nodes['#game'].events.touchmove({touches:[{clientX:90,clientY:420}],preventDefault(){}});
 a.tick(90);assert.equal(a.game.seconds,19);assert(a.game.hero.x<1000);assert.equal(a.game.state,'playing');
});
test('native touchscreen activation and drag do not require pointer capture',async()=>{
 const a=await bootApp({coarse:true,width:390,height:844});
 assert.match(a.html,/touch-action:none/);assert.match(a.html,/pointer-events:auto/);
 a.nodes['#start'].events.click();assert.equal(a.plays(),1);let prevented=false;
 a.nodes['#game'].events.touchmove({touches:[{clientX:80,clientY:420}],preventDefault(){prevented=true;}});
 a.tick(90);assert(prevented);assert(a.game.hero.x<900);assert.equal(a.game.seconds,19);
 const elapsed=a.game.elapsed;a.nodes['#game'].events.touchend();assert.equal(a.game.elapsed,elapsed);assert(a.plays()>=2);
});
test('resume does not wait for an unresolved media permission promise',async()=>{
 const a=await bootApp({suspended:true});a.nodes['#start'].events.click();a.tick(30);
 a.document.hidden=true;a.events.visibilitychange();a.tick(40);const elapsed=a.game.elapsed;
 assert.equal(a.nodes['#resume'].hidden,false);a.document.hidden=false;a.nodes['#resume'].events.click();a.tick(40);
 assert(a.game.elapsed>elapsed+.5);assert.equal(a.nodes['#resume'].hidden,true);
});
