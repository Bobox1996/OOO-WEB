import type { EnvironmentState } from './types';
import type { Vector3 } from 'three/webgpu';
/** All sound is synthesized locally. Audio starts only after an explicit Sound gesture. */
export class AudioSystem {
  private context?:AudioContext;private master?:GainNode;private wind?:GainNode;private fire?:GainNode;
  private noise?:AudioBuffer;private sources:AudioBufferSourceNode[]=[];private lastStep=0;private lastPosition?:{x:number;z:number};
  private enabled=false;private disposed=false;
  async enable(on:boolean){
    if(this.disposed)return;this.enabled=on;
    if(!on){this.master?.gain.setTargetAtTime(0,this.context!.currentTime,.15);return;}
    if(!this.context){
      const ctx=this.context=new AudioContext();this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
      this.noise=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate);const data=this.noise.getChannelData(0);let brown=0;
      for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.015;data[i]=brown*3;}
      this.wind=this.loop(600,'lowpass');this.fire=this.loop(1900,'highpass');
    }
    await this.context.resume();if(this.enabled&&!this.disposed)this.master!.gain.setTargetAtTime(.48,this.context.currentTime,.4);
  }
  private loop(frequency:number,type:BiquadFilterType){
    const ctx=this.context!,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=this.noise!;source.loop=true;filter.type=type;filter.frequency.value=frequency;gain.gain.value=0;
    source.connect(filter).connect(gain).connect(this.master!);source.start();this.sources.push(source);return gain;
  }
  update(s:EnvironmentState,p:Vector3,elapsed:number,walking:boolean){
    if(!this.context||!s.sound)return;const t=this.context.currentTime;
    const gust=.75+Math.sin(elapsed*.29)*.16+Math.sin(elapsed*.73)*.08;
    this.wind!.gain.setTargetAtTime(s.paused?.05:(.09+s.windSpeed*.024)*gust,t,.5);
    this.fire!.gain.setTargetAtTime(Math.max(0,1-Math.hypot(p.x,p.z)/28)*.65,t,.4);
    if(walking&&!s.paused&&this.lastPosition&&Math.hypot(p.x-this.lastPosition.x,p.z-this.lastPosition.z)>.7&&elapsed-this.lastStep>.32){this.footstep();this.lastStep=elapsed;this.lastPosition={x:p.x,z:p.z};}
    if(!this.lastPosition||!walking)this.lastPosition={x:p.x,z:p.z};
  }
  private footstep(){const ctx=this.context!,src=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();src.buffer=this.noise!;filter.type='lowpass';filter.frequency.value=1100;gain.gain.setValueAtTime(.7,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.24);src.connect(filter).connect(gain).connect(this.master!);src.start(0,Math.random()*4,.25);src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};}
  dispose(){this.disposed=true;this.enabled=false;this.sources.forEach(s=>s.stop());void this.context?.close();}
}
