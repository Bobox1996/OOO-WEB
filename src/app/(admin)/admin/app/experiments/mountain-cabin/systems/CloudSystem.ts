import * as THREE from 'three/webgpu';
import { positionWorld, positionView, positionLocal, uniform, vec3, mx_fractal_noise_float, mx_noise_float, mix, smoothstep, exp, viewportDepthTexture, perspectiveDepthToViewZ, cameraNear, cameraFar } from 'three/tsl';
import type { EnvironmentState } from './types';
import { QUALITY, SITE_ELEVATION } from './types';
import type { WeatherFrame } from './WeatherSystem';
/** Stratified density slices: kilometre-scale continuous cloud fields, shaded by a second density sample toward the sun. */
export class CloudSystem {
  group=new THREE.Group();private layers:THREE.Mesh[]=[];
  private drift=uniform(new THREE.Vector3());private coverage=uniform(.6);private alpha=uniform(.2);
  private light=uniform(new THREE.Color(0xd4dae2));private shade=uniform(new THREE.Color(0x71859d));
  private sunOffset=uniform(new THREE.Vector3(120,100,80));
  private opaqueDepth=viewportDepthTexture();
  private elapsed=0;
  constructor(private scene:THREE.Scene,state:EnvironmentState){scene.add(this.group);this.build(state.quality);}
  private build(q:EnvironmentState['quality']){
    for(const l of this.layers){l.geometry.dispose();(l.material as THREE.Material).dispose();this.group.remove(l);}this.layers=[];
    const count=QUALITY[q].clouds;
    for(let i=0;i<count;i++){
      const m=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide});
      const p=positionWorld.add(this.drift).mul(.0006);
      const warp=mx_noise_float(p.mul(.43)).mul(.75);
      const field=mx_fractal_noise_float(p.add(vec3(warp,warp.mul(.3),warp)),2,2,.52).mul(.5).add(.5);
      const density=smoothstep(this.coverage.oneMinus().mul(.55).add(.12),.79,field);
      const sunlight=mx_noise_float(positionWorld.add(this.drift).add(this.sunOffset).mul(.0006)).mul(.5).add(.5);
      m.colorNode=mix(this.shade,this.light,sunlight.mul(.85).add(.12));
      const edge=exp(positionWorld.xz.length().div(24000).pow(6).negate());
      const behindSurface=perspectiveDepthToViewZ(this.opaqueDepth.r,cameraNear,cameraFar);
      const intersectionFade=smoothstep(0,190,positionView.z.sub(behindSurface));
      m.opacityNode=density.mul(this.alpha).mul(edge).mul(intersectionFade).mul(1-Math.abs(i/(count-1||1)-.5)*.5);
      const cloudLift=mx_fractal_noise_float(positionLocal.add(this.drift).mul(.0004),3,2,.5).mul(180);
      m.positionNode=positionLocal.add(vec3(0,cloudLift,0));
      const geometry=new THREE.PlaneGeometry(65000,65000,72,72);geometry.rotateX(-Math.PI/2);
      const mesh=new THREE.Mesh(geometry,m);
      mesh.position.y=-600+i*55;mesh.renderOrder=2;mesh.frustumCulled=false;
      this.group.add(mesh);this.layers.push(mesh);
    }
  }
  update(s:EnvironmentState,f:WeatherFrame,dt:number){
    if(!s.paused)this.elapsed+=dt;
    const angle=s.windDirection*Math.PI/180;
    this.drift.value.set(Math.cos(angle)*this.elapsed*s.windSpeed*.7,0,Math.sin(angle)*this.elapsed*s.windSpeed*.7);
    this.coverage.value=s.cloudDensity;
    this.alpha.value=(.14+f.inversion*.3+f.storm*.1)*s.cloudDensity;
    this.layers.forEach((l,i)=>l.position.y=s.cloudAltitude-SITE_ELEVATION+i*42-100);
    this.light.value.set(0xe3e8e9).lerp(new THREE.Color(0xf5c6ad),f.twilight*.4).multiplyScalar(.2+f.daylight*.8).lerp(new THREE.Color(0x111d32),f.night*.7);
    this.shade.value.set(0x7f9db4).multiplyScalar(.3+f.daylight*.7).lerp(new THREE.Color(0x0a1323),f.night*.7);
    this.sunOffset.value.copy(f.sun).multiplyScalar(250);
  }
  setQuality(q:EnvironmentState['quality']){this.build(q);}
  dispose(){for(const l of this.layers){l.geometry.dispose();(l.material as THREE.Material).dispose();}this.scene.remove(this.group);}
}
