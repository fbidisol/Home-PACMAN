import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

export async function bootApp({coarse=false,decodePending=false,suspended=false,blocked=false,width=1900,height=800,context=true}={}){
  const html=readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
  let code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.match(code,/const game=new Game\(ART.foods\);/);
  code=code.replace('const game=new Game(ART.foods);','const game=new Game(ART.foods);window.__game=game;');
  let scheduled,clock=0,plays=0,pauses=0;
  const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  class Element{
    constructor(){
      this.style={};this.events={};this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';
      this.classList={add(){}};this.currentTime=0;this.paused=true;this.readyState=4;this.seeking=false;this.volume=1;
    }
    addEventListener(n,fn){this.events[n]=fn;}
    setAttribute(n,v){this[n]=v;}
    getAttribute(n){return this[n]??null;}
    getBoundingClientRect(){return{width,height,left:0,top:0};}
    getContext(n){return n==='2d'?ctx:null;}
    before(){} load(){}
    setPointerCapture(){throw new Error('capture unavailable in webview');}
    play(){plays++;if(blocked)return Promise.reject(new Error('NotAllowedError'));this.paused=false;return Promise.resolve();}
    pause(){pauses++;this.paused=true;}
  }
  const nodes=Object.fromEntries(['#game','#music','#announcement','#start','#sound','#resume','main'].map(n=>[n,new Element()]));
  nodes['#resume'].hidden=true;
  const events={};
  const document={querySelector:n=>nodes[n],createElement:()=>new Element(),body:new Element(),documentElement:{style:{setProperty(){}}},hidden:false,addEventListener:(n,f)=>events[n]=f};
  class AudioContext{
    constructor(){this.currentTime=0;this.state='suspended';this.destination={};}
    createGain(){return{gain:{value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}},connect(){}};}
    createBuffer(){return{};}
    decodeAudioData(){return decodePending?new Promise(()=>{}):Promise.resolve({duration:20});}
    resume(){if(suspended)return new Promise(()=>{});this.state='running';return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    createBufferSource(){return{connect(){},start(){},stop(){}};}
  }
  const window={devicePixelRatio:2,AudioContext:context?AudioContext:undefined,addEventListener(){}};
  const sandbox={window,document,matchMedia:q=>({matches:q==='(pointer: coarse)'&&coarse}),
    Path2D:class{},ResizeObserver:class{observe(){}},performance:{now:()=>clock},
    requestAnimationFrame:f=>scheduled=f,atob:s=>Buffer.from(s,'base64').toString('binary'),console,
    fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)})};
  vm.runInNewContext(code,sandbox,{timeout:3000});
  await new Promise(resolve=>setImmediate(resolve));
  const tick=(n=1)=>{for(let i=0;i<n;i++){clock+=16;scheduled(clock);}};tick();
  return{html,nodes,events,document,game:window.__game,tick,plays:()=>plays,pauses:()=>pauses};
}
