import * as THREE from 'three/webgpu';
import type { EnvironmentState } from './types';
import { QUALITY } from './types';
import type { WeatherFrame } from './WeatherSystem';
export class LightingSystem {
  sun=new THREE.DirectionalLight(0xffedd8,3);
  moon=new THREE.DirectionalLight(0xa1c6ff,.12);
  sky=new THREE.HemisphereLight(0xb9d6ef,0x52616d,1);
  ambient=new THREE.AmbientLight(0x9fb2c3,.08);
  constructor(private scene:THREE.Scene,state:EnvironmentState){
    this.sun.castShadow=true;this.sun.shadow.mapSize.setScalar(QUALITY[state.quality].shadow);
    const sc=this.sun.shadow.camera;sc.left=-60;sc.right=60;sc.top=60;sc.bottom=-60;sc.near=1;sc.far=450;
    this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.06;this.sun.shadow.radius=3;
    this.moon.position.set(-80,150,70);
    scene.add(this.sun,this.sun.target,this.moon,this.sky,this.ambient);
  }
  update(s:EnvironmentState,f:WeatherFrame){
    this.sun.position.copy(f.sun).multiplyScalar(180);this.sun.target.position.set(0,0,0);
    this.sun.intensity=f.daylight*(1-f.overcast*.86)*(2.1+Math.max(0,f.sun.y)*1.6);
    this.sun.color.set(0xfff1dd).lerp(new THREE.Color(0xffb281),f.twilight*.8);
    this.sky.color.set(0xa7c7e1).lerp(new THREE.Color(0x386a9b),1-f.daylight).lerp(new THREE.Color(0x9cabb9),f.overcast*.7);
    this.sky.groundColor.set(0x67778b).lerp(new THREE.Color(0x111e37),1-f.daylight);
    this.sky.intensity=(.64+f.daylight*1.05)*(1-f.storm*.4)*(1-f.night*.75);
    this.moon.intensity=.15*f.night;this.ambient.intensity=.05+.1*f.daylight;
  }
  setQuality(q:EnvironmentState['quality']){this.sun.shadow.mapSize.setScalar(QUALITY[q].shadow);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.needsUpdate=true;}
  dispose(){this.sun.shadow.dispose();for(const item of [this.sun,this.sun.target,this.moon,this.sky,this.ambient])this.scene.remove(item);}
}
