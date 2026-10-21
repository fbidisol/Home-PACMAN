import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RoundSound} from './audio.mjs';

test('a rejected native play recovers through a context unlocked in the same gesture',async()=>{
  const starts=[],statuses=[];let contexts=0,plays=0;
  const clock={state:'playing',elapsed:.75,paused:false,muted:false};
  const element={src:'',paused:true,readyState:4,seeking:false,currentTime:0,volume:1,
    setAttribute(){},getAttribute(n){return this[n]||null;},addEventListener(){},load(){},pause(){this.paused=true;},
    play(){plays++;return Promise.reject(new Error('NotAllowedError'));}};
  class Context{
    constructor(){contexts++;this.state='suspended';this.currentTime=3;this.destination={};}
    createGain(){return{connect(){},gain:{value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}}};}
    createBuffer(){return{duration:0};}
    resume(){this.state='running';return Promise.resolve();}
    createBufferSource(){return{buffer:null,connect(){},stop(){},start(...args){starts.push({duration:this.buffer.duration,args});}};}
    decodeAudioData(){return Promise.resolve({duration:20});}
  }
  const sound=new RoundSound({element,urls:['audio/idisol-3-20s.mp3'],encoded:['AAAA'],clock:()=>clock,onstatus:s=>statuses.push(s),Context});
  await sound.load();assert.equal(contexts,0);assert.equal(plays,0);
  sound.start(0);assert.equal(plays,1);assert.equal(contexts,1);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(element.src,'audio/idisol-3-20s.mp3');assert.equal(sound.mode,'buffer');assert.equal(sound.blocked,false);
  assert.equal(starts.at(-1).duration,20);assert.equal(starts.at(-1).args[1],.75);assert.equal(starts.at(-1).args[2],19.25);
  assert.equal(statuses.at(-1),'playing');
  sound.stop(0);assert.equal(sound.active,false);
});

test('a native play abort after successful recovery cannot overwrite the playing status',async()=>{
  let rejectPlay;const statuses=[],events={};
  const element={src:'',paused:true,readyState:1,seeking:false,currentTime:0,volume:1,
    setAttribute(){},getAttribute(n){return this[n]||null;},addEventListener(n,fn){events[n]=fn;},load(){},
    pause(){this.paused=true;if(rejectPlay){const reject=rejectPlay;rejectPlay=null;reject(new Error('AbortError'));}},
    play(){return new Promise((_,reject)=>rejectPlay=reject);}};
  class Context{
    constructor(){this.state='running';this.currentTime=0;this.destination={};}
    createGain(){return{connect(){},gain:{value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}}};}
    createBuffer(){return{};}resume(){return Promise.resolve();}
    createBufferSource(){return{buffer:null,connect(){},stop(){},start(){}};}
    decodeAudioData(){return Promise.resolve({duration:20});}
  }
  const sound=new RoundSound({element,encoded:['AAAA'],clock:()=>({state:'playing',elapsed:1.3,paused:false,muted:false}),onstatus:s=>statuses.push(s),Context});
  await sound.load();sound.start(0);await new Promise(resolve=>setImmediate(resolve));
  sound.tick(1.3);await new Promise(resolve=>setImmediate(resolve));events.error();
  assert.equal(sound.mode,'buffer');assert.equal(sound.blocked,false);assert.equal(statuses.at(-1),'playing');
});
