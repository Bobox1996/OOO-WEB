import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { TerrainSystem } from './TerrainSystem';
import { CabinSystem } from './CabinSystem';
import { VegetationSystem } from './VegetationSystem';
import { WeatherSystem } from './WeatherSystem';
import { AtmosphereSystem } from './AtmosphereSystem';
import { CloudSystem } from './CloudSystem';
import { LightingSystem } from './LightingSystem';
import { CameraSystem, type MoveDirection } from './CameraSystem';
import { SnowfallSystem } from './SnowfallSystem';
import { AudioSystem } from './AudioSystem';
import { INITIAL_STATE, QUALITY, type EnvironmentState, type CameraMode, type RuntimeStats } from './types';

export class AlpineEngine {
  private scene=new THREE.Scene();private renderer?:THREE.WebGPURenderer;private post?:THREE.RenderPipeline;
  private terrain?:TerrainSystem;private cabin?:CabinSystem;private vegetation?:VegetationSystem;private atmosphere?:AtmosphereSystem;
  private clouds?:CloudSystem;private lighting?:LightingSystem;private cameras?:CameraSystem;private snowfall?:SnowfallSystem;
  private audio=new AudioSystem();private weather?:WeatherSystem;private state={...INITIAL_STATE};
  private disposed=false;private ready=false;private observer?:ResizeObserver;private elapsed=0;private last=0;private statsStart=0;private frames=0;private backend='WebGPU';
  private env?:THREE.DataTexture;private adaptiveRatio=1.5;private lastAdapt=0;private captureTask?:{resolve:()=>void;reject:(reason:Error)=>void};
  constructor(private host:HTMLDivElement,private onStats:(stats:RuntimeStats)=>void){}
  async init(initial:EnvironmentState){
    this.state={...initial};if(window.innerWidth<700&&this.state.quality==='High')this.state.quality='Medium';
    this.onStats({loading:true,fps:0,backend:'Initializing'});
    try{
      const renderer=this.renderer=new THREE.WebGPURenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      this.adaptiveRatio=Math.min(window.devicePixelRatio||1,QUALITY[this.state.quality].pixelRatio);renderer.setPixelRatio(this.adaptiveRatio);
      await renderer.init();if(this.disposed){renderer.dispose();return;}
      this.backend=(renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend?'WebGPU':'WebGL 2 · reduced';
      if(this.backend.startsWith('WebGL')){this.state.quality='Low';renderer.setPixelRatio(1);}
      renderer.domElement.setAttribute('aria-label','Interactive alpine landscape. Drag to orbit, scroll to zoom.');
      renderer.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none';this.host.appendChild(renderer.domElement);
      this.weather=new WeatherSystem(this.state);
      this.terrain=new TerrainSystem(this.scene,this.state);
      const heightAt=(x:number,z:number)=>this.terrain!.heightAt(x,z);
      this.cameras=new CameraSystem(renderer.domElement,heightAt);
      this.lighting=new LightingSystem(this.scene,this.state);
      this.atmosphere=new AtmosphereSystem(this.scene);
      this.clouds=new CloudSystem(this.scene,this.state);
      this.cabin=new CabinSystem(this.scene,heightAt);
      this.vegetation=new VegetationSystem(this.scene,heightAt,this.state);
      this.snowfall=new SnowfallSystem(this.scene,this.state);
      this.makeEnvironment();
      const renderPass=pass(this.scene,this.cameras.camera);const output=renderPass.getTextureNode('output');
      this.post=new THREE.RenderPipeline(renderer);this.post.outputNode=output.add(bloom(output,.12,.3,1.7));
      this.observer=new ResizeObserver(this.resize);this.observer.observe(this.host);this.resize();
      this.updateSystems(.016);
      await renderer.compileAsync(this.scene,this.cameras.camera);
      if(this.disposed)return;
      this.last=performance.now();this.statsStart=this.last;
      this.ready=true;await renderer.setAnimationLoop(this.tick);
      this.onStats({loading:false,fps:0,backend:this.backend});
    }catch(error){if(!this.disposed){this.onStats({loading:false,fps:0,backend:this.backend,error:error instanceof Error?error.message:'Unable to initialize graphics.'});}throw error;}
  }
  private makeEnvironment(){
    const w=128,h=64,data=new Uint8Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const t=y/h,c=new THREE.Color(t<.5?'#9ebbd1':'#a0adb1');
      if(t<.5)c.lerp(new THREE.Color('#d9e3e9'),t*2);else c.multiplyScalar(.62);
      const i=(y*w+x)*4;data[i]=c.r*255;data[i+1]=c.g*255;data[i+2]=c.b*255;data[i+3]=255;
    }
    this.env=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);this.env.mapping=THREE.EquirectangularReflectionMapping;this.env.minFilter=THREE.LinearFilter;this.env.magFilter=THREE.LinearFilter;this.env.needsUpdate=true;
    this.scene.environment=this.env;
  }
  private resize=()=>{if(!this.renderer||!this.cameras)return;const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight);this.renderer.setSize(w,h,false);this.cameras.resize(w,h);};
  private tick=(now:number)=>{
    if(this.disposed||!this.renderer||!this.cameras)return;
    const dt=Math.min(.05,Math.max(.001,(now-this.last)/1000));this.last=now;
    try{
      this.updateSystems(dt);
      if(this.state.quality==='Low')this.renderer.render(this.scene,this.cameras.camera);else this.post!.render();
      if(this.captureTask)this.saveCapture();
      this.frames++;
      if(now-this.statsStart>1200){
        const fps=Math.round(this.frames*1000/(now-this.statsStart));this.frames=0;this.statsStart=now;
        this.onStats({loading:false,fps,backend:this.backend});
        if(now-this.lastAdapt>5000){
          const max=Math.min(window.devicePixelRatio||1,QUALITY[this.state.quality].pixelRatio);
          const desired=fps<35?Math.max(.7,this.adaptiveRatio-.15):fps>57?Math.min(max,this.adaptiveRatio+.05):this.adaptiveRatio;
          if(Math.abs(desired-this.adaptiveRatio)>.01){this.adaptiveRatio=desired;this.renderer.setPixelRatio(desired);this.resize();}this.lastAdapt=now;
        }
      }
    }catch(error){this.ready=false;this.renderer.setAnimationLoop(null);this.captureTask?.reject(new Error('Rendering stopped before capture.'));this.captureTask=undefined;this.onStats({loading:false,fps:0,backend:this.backend,error:error instanceof Error?error.message:'Rendering stopped.'});}
  };
  private updateSystems(dt:number){
    const weather=this.weather!,camera=this.cameras!.camera;
    weather.update(dt,this.state);const s=weather.state,f=weather.frame;
    if(!this.state.paused)this.elapsed+=dt;
    this.cameras!.update(dt,s.fov);this.terrain!.updateState(s);this.terrain!.update(camera);
    this.lighting!.update(s,f);this.atmosphere!.update(s,f,camera);this.clouds!.update(s,f,dt);
    this.cabin!.update(s,this.state.paused?0:dt,this.elapsed);this.vegetation!.update(s,this.elapsed);
    this.snowfall!.update(s,f,dt,camera);this.renderer!.toneMappingExposure=s.exposure;
    this.scene.environmentIntensity=.08+f.daylight*.48;
    this.audio.update(s,camera.position,this.elapsed,this.cameras!.mode==='First Person');
  }
  setState(patch:Partial<EnvironmentState>){
    if(this.disposed)return;const old=this.state;this.state={...old,...patch};
    if(patch.quality&&patch.quality!==old.quality){
      this.terrain?.setQuality(patch.quality);this.vegetation?.setQuality(patch.quality);this.clouds?.setQuality(patch.quality);this.lighting?.setQuality(patch.quality);this.snowfall?.setQuality(patch.quality);
      this.adaptiveRatio=Math.min(window.devicePixelRatio||1,QUALITY[patch.quality].pixelRatio);this.renderer?.setPixelRatio(this.adaptiveRatio);this.resize();
    }
    if(patch.seed!==undefined&&patch.seed!==old.seed){this.terrain?.regenerate(patch.seed);this.vegetation?.regenerate(patch.seed);this.cameras?.setMode('Cabin');}
    if(patch.sound!==undefined&&patch.sound!==old.sound)void this.audio.enable(patch.sound).catch(()=>{});
  }
  setCamera(mode:CameraMode){this.cameras?.setMode(mode);}
  setMove(direction:MoveDirection,pressed:boolean){this.cameras?.setMove(direction,pressed);}
  resetView(){this.cameras?.setMode('Cabin');}
  capture():Promise<void>{if(this.disposed||!this.ready)return Promise.reject(new Error('Wait for the landscape to finish loading.'));if(this.captureTask)return Promise.reject(new Error('A capture is already in progress.'));return new Promise((resolve,reject)=>{this.captureTask={resolve,reject};});}
  private saveCapture(){
    const task=this.captureTask!;this.captureTask=undefined;
    this.renderer!.domElement.toBlob(blob=>{
      if(!blob){task.reject(new Error('Image capture is unavailable in this browser.'));return;}
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Mountain-Cabin-${this.state.seed}-${this.state.time.toFixed(2)}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);task.resolve();
    },'image/png');
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.ready=false;void this.renderer?.setAnimationLoop(null);this.observer?.disconnect();
    this.captureTask?.reject(new Error('Scene closed.'));this.captureTask=undefined;
    this.cameras?.dispose();this.terrain?.dispose();this.cabin?.dispose();this.vegetation?.dispose();this.clouds?.dispose();this.atmosphere?.dispose();this.snowfall?.dispose();this.lighting?.dispose();this.audio.dispose();
    this.post?.dispose();this.env?.dispose();this.renderer?.dispose();this.renderer?.domElement.remove();
  }
}
