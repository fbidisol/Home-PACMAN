// One persistent <audio> element, regular MP3 URLs on the hosted site, and a
// Web Audio recovery path unlocked synchronously by the same trusted gesture.
export class RoundSound {
  constructor({element,urls=[],encoded=[],clock,onstatus,Context}){
    this.element=element;this.urls=urls;this.encoded=encoded;this.clock=clock;this.onstatus=onstatus;
    this.Context=Context||(typeof window!=='undefined'?(window.AudioContext||window.webkitAudioContext):null);
    this.index=0;this.serial=0;this.mode='media';this.blocked=false;this.active=false;
    this.context=null;this.gain=null;this.source=null;this.buffers=[];this.bytes=[];
    this.fade=null;this.waiting=0;this.lastPosition=0;this.syncAge=0;this.lastSeek=-10;this.pending=0;
    element.preload='auto';element.playsInline=true;element.setAttribute('playsinline','');
    element.addEventListener('error',()=>{if(this.active&&this.mode==='media'){this.status('blocked');this.recover(this.serial);}});
    element.addEventListener('playing',()=>{if(this.active&&this.mode==='media'){this.status('playing');this.align(true);}});
  }
  status(value){this.blocked=value==='blocked';this.onstatus(value);}
  live(){const g=this.clock();return this.active&&g.state==='playing'&&!g.paused&&g.elapsed<20;}
  async load(){this.prepare(0);this.getBytes(0).catch(()=>{});}
  prepare(index){
    this.index=index;
    const url=this.urls[index]||(this.encoded[index]?'data:audio/mpeg;base64,'+this.encoded[index]:'');
    if(url&&this.element.getAttribute('src')!==url){this.element.src=url;this.element.load();}
  }
  getBytes(index){
    if(!this.bytes[index])this.bytes[index]=this.encoded[index]
      ?Promise.resolve(Uint8Array.from(atob(this.encoded[index]),c=>c.charCodeAt(0)).buffer)
      :fetch(this.urls[index],{credentials:'same-origin'}).then(r=>{if(!r.ok)throw new Error('Audio HTTP '+r.status);return r.arrayBuffer();});
    return this.bytes[index];
  }
  unlock(){
    if(!this.Context)return;
    try{
      if(!this.context){
        this.context=new this.Context();this.gain=this.context.createGain();this.gain.connect(this.context.destination);
      }
      // Both resume and silent priming happen in the user's event, before any await.
      const resume=this.context.resume();
      if(this.context.createBuffer){
        const silent=this.context.createBufferSource();silent.buffer=this.context.createBuffer(1,1,22050);
        silent.connect(this.context.destination);silent.start(0);
      }
      Promise.resolve(resume).then(()=>{if(this.blocked&&this.live())this.recover(this.serial);}).catch(()=>{});
      if(!this.buffers[this.index])this.buffers[this.index]=this.getBytes(this.index).then(bytes=>this.context.decodeAudioData(bytes.slice(0)));
      this.buffers[this.index].catch(()=>{});
    }catch{}
  }
  start(index){
    this.stop(0);this.prepare(index);this.active=true;this.mode='media';this.waiting=0;this.lastPosition=0;this.lastSeek=-10;
    try{this.element.currentTime=0;}catch{}
    this.element.volume=1;this.element.muted=this.clock().muted;this.ensurePlaying();
  }
  ensurePlaying(){
    if(!this.live())return;
    this.unlock();
    if(this.mode==='buffer'){
      this.recover(this.serial,true);return;
    }
    const token=this.serial;
    try{
      // Native play is synchronous in click/touchend, on an element in the DOM.
      const promise=this.element.play();
      Promise.resolve(promise).then(()=>{
        if(token!==this.serial||!this.live()||this.mode!=='media')return;
        this.status('playing');this.align(true);
      }).catch(()=>{if(token===this.serial&&this.live()&&this.mode==='media'){this.status('blocked');this.recover(token);}});
    }catch{this.status('blocked');this.recover(token);}
  }
  async recover(token,force=false){
    if(!this.context||!this.buffers[this.index]||!this.live()||this.pending===token+1)return;
    this.pending=token+1;
    try{
      const buffer=await this.buffers[this.index];
      if(token!==this.serial||!this.live()||this.context.state!=='running')return;
      if(this.mode==='buffer'&&this.source&&!force)return;
      this.element.pause();if(this.source){try{this.source.stop();}catch{}}
      const offset=this.clock().elapsed;
      const t=this.context.currentTime;this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.clock().muted?0:1,t);
      const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.gain);
      source.start(0,offset,Math.max(.001,20-offset));this.source=source;this.mode='buffer';this.status('playing');
    }catch{if(token===this.serial&&this.live())this.status('blocked');}
    finally{if(this.pending===token+1)this.pending=0;}
  }
  align(force=false){
    if(!this.live()||this.mode!=='media'||this.element.paused||this.element.seeking||this.element.readyState<3)return;
    const elapsed=this.clock().elapsed,delta=Math.abs(this.element.currentTime-elapsed);
    // Avoid repeated seeks while Safari is buffering. It can otherwise loop
    // between seeking and playback without producing audible output.
    if(delta>(force ? .35 : .7)&&(force||elapsed-this.lastSeek>2)){
      try{this.element.currentTime=elapsed;this.lastSeek=elapsed;}catch{}
    }
  }
  tick(dt){
    if(this.fade){
      this.fade.age+=dt;const k=Math.max(0,1-this.fade.age/this.fade.duration);
      try{this.element.volume=k;}catch{}
      if(this.fade.age>=this.fade.duration){this.element.pause();this.fade=null;}
    }
    if(!this.live()||this.mode!=='media')return;
    if(this.element.currentTime>this.lastPosition+.001){this.waiting=0;this.lastPosition=this.element.currentTime;}
    else this.waiting+=dt;
    if(this.waiting>1.2){this.recover(this.serial);this.waiting=0;}
    this.syncAge+=dt;if(this.syncAge>1){this.syncAge=0;this.align();}
  }
  stop(fade=.1){
    this.serial++;this.pending=0;this.active=false;
    if(this.fade){this.element.pause();this.fade=null;}
    if(this.source){
      const node=this.source;this.source=null;const t=this.context.currentTime;
      this.gain.gain.cancelScheduledValues(t);this.gain.gain.setValueAtTime(this.gain.gain.value,t);
      this.gain.gain.linearRampToValueAtTime(0,t+fade);try{node.stop(t+fade+.015);}catch{}
      this.element.pause();
    }else if(fade>0&&!this.element.paused)this.fade={age:0,duration:fade};
    else this.element.pause();
    this.status('idle');
  }
  mute(){
    this.element.muted=this.clock().muted;
    if(this.gain){const t=this.context.currentTime;this.gain.gain.cancelScheduledValues(t);this.gain.gain.setTargetAtTime(this.clock().muted?0:1,t,.025);}
    this.status(this.blocked?'blocked':this.active?'playing':'idle');
  }
  pause(){this.element.pause();if(this.context)this.context.suspend().catch(()=>{});}
  resume(){this.ensurePlaying();}
}
