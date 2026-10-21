import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bootApp} from './test-support.mjs';
test('bundled app starts media on gesture, pauses and returns after timeout',async()=>{
 const a=await bootApp();assert.equal(a.nodes['#start'].disabled,false);assert.equal(a.plays(),0);
 a.nodes['#start'].events.click();assert.equal(a.plays(),1);a.tick();assert.equal(a.game.state,'playing');
 a.document.hidden=true;a.events.visibilitychange();a.tick();assert.equal(a.nodes['#resume'].hidden,false);assert(a.pauses()>0);
 a.document.hidden=false;a.nodes['#resume'].events.click();assert.equal(a.nodes['#resume'].hidden,true);
 a.tick(1350);assert.equal(a.game.state,'idle');assert.equal(a.nodes['#start'].hidden,false);
});
test('all game states share a footer-free DOM and persistent audio element with a real MP3 URL',async()=>{
 const a=await bootApp();assert(!a.html.includes('id="hint"'));assert(!a.html.includes('<footer'));
 assert(a.html.includes('<audio id="music"'));assert(a.nodes['#music'].src.endsWith('idisol-3-20s.mp3'));
 assert(!a.nodes['#music'].src.startsWith('data:'));a.nodes['#start'].events.click();a.tick(1400);a.nodes['#start'].events.click();
 assert.equal(a.plays(),2);assert.equal(a.nodes['#music'].src,'audio/idisol-3-20s.mp3');
});
