import * as THREE from 'three/webgpu';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { cameraPosition, positionWorld, uniform, exp, fog, max, mix, smoothstep, vec4 } from 'three/tsl';
import type { EnvironmentState } from './types';
import type { WeatherFrame } from './WeatherSystem';
export class AtmosphereSystem {
  private sky=new SkyMesh();
  private haze=uniform(new THREE.Color(0x9cafc2));
  private density=uniform(.000035);
  private valley=uniform(.16);
  private zenith=uniform(new THREE.Color(0x123951));private horizon=uniform(new THREE.Color(0x8295ae));private grade=uniform(0);
  private stars:THREE.Points;
  private starMaterial=new THREE.PointsNodeMaterial({color:0xd5e8ff,size:1.5,sizeAttenuation:false,transparent:true,depthWrite:false,fog:false});
  constructor(private scene:THREE.Scene){
    // Clouds use this scene's pausable simulation clock, not SkyMesh's global time.
    this.sky.cloudDensity.value=0;this.sky.cloudCoverage.value=0;
    this.sky.scale.setScalar(90000);this.sky.material.depthWrite=false;this.sky.material.fog=false;this.sky.renderOrder=-10;this.sky.frustumCulled=false;scene.add(this.sky);
    const physicalSky=this.sky.material.colorNode!;
    const skyHeight=smoothstep(0,.8,positionWorld.sub(cameraPosition).normalize().y);
    this.sky.material.colorNode=vec4(mix(vec4(physicalSky).rgb,mix(this.horizon,this.zenith,skyHeight),this.grade),1);
    const dist=positionWorld.sub(cameraPosition).length();
    const altitude=max(positionWorld.y.add(cameraPosition.y).mul(.5).add(250),0);
    const extinction=this.density.mul(exp(altitude.mul(-.00038)).add(this.valley));
    scene.fogNode=fog(this.haze,exp(dist.mul(extinction).negate()).oneMinus().clamp(0,.985));
    const a=new Float32Array(1600*3);let seed=8125;
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<1600;i++){const y=rand()*.95+.03,t=rand()*Math.PI*2,r=Math.sqrt(1-y*y);a.set([Math.cos(t)*r*34000,y*34000,Math.sin(t)*r*34000],i*3);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a,3));
    this.stars=new THREE.Points(g,this.starMaterial);this.stars.frustumCulled=false;scene.add(this.stars);
  }
  update(s:EnvironmentState,f:WeatherFrame,camera:THREE.Camera){
    this.sky.position.copy(camera.position);this.stars.position.copy(camera.position);
    this.sky.sunPosition.value.copy(f.sun).multiplyScalar(450000);
    this.sky.rayleigh.value=2.4;this.sky.turbidity.value=2.4+f.overcast*14;
    this.sky.mieCoefficient.value=.003+f.overcast*.024;
    this.sky.mieDirectionalG.value=.82;
    this.grade.value=(1-f.daylight)*.92+f.daylight*f.overcast*.55;
    this.zenith.value.set(0x154964).lerp(new THREE.Color(0x020611),f.night).lerp(new THREE.Color(0x536675),f.overcast*(1-f.night));
    this.horizon.value.set(0x698fa8).lerp(new THREE.Color(0x091328),f.night).lerp(new THREE.Color(0x8a9eac),f.overcast*(1-f.night));
    const haze=new THREE.Color(0xaec8dc).lerp(new THREE.Color(0x698fa8),1-f.daylight).lerp(new THREE.Color(0x091328),f.night);
    haze.lerp(new THREE.Color(0x8099aa).multiplyScalar(.3+f.daylight*.7),f.overcast*.75);
    this.haze.value.copy(haze);
    this.density.value=(1.1/Math.max(600,s.visibility*1000))*(1+f.storm*23+f.snow*1.8);
    this.valley.value=.2+f.inversion*.22;
    this.starMaterial.opacity=f.night*(1-f.overcast)*.8;
    this.stars.visible=this.starMaterial.opacity>.01;
  }
  dispose(){this.sky.geometry.dispose();this.sky.material.dispose();this.stars.geometry.dispose();this.starMaterial.dispose();this.scene.remove(this.sky,this.stars);this.scene.fogNode=null;}
}
