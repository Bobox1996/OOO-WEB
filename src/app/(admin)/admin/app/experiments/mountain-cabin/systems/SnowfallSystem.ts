import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, positionLocal, uniform, vec3, uv, smoothstep, sin } from 'three/tsl';
import type { EnvironmentState } from './types';
import { QUALITY } from './types';
import type { WeatherFrame } from './WeatherSystem';
export class SnowfallSystem {
  private mesh!:THREE.Mesh;private material!:THREE.MeshBasicNodeMaterial;
  private clock=uniform(0);private wind=uniform(new THREE.Vector3());private anchor=uniform(new THREE.Vector3());
  private right=uniform(new THREE.Vector3(1,0,0));private up=uniform(new THREE.Vector3(0,1,0));private opacity=uniform(0);
  constructor(private scene:THREE.Scene,s:EnvironmentState){this.build(s.quality);}
  private build(q:EnvironmentState['quality']){
    if(this.mesh){this.mesh.geometry.dispose();this.material.dispose();this.scene.remove(this.mesh);}
    const count=QUALITY[q].particles,base=new Float32Array(count*3);let n=7721;
    for(let i=0;i<base.length;i++){n=(Math.imul(n,1664525)+1013904223)>>>0;base[i]=n/4294967296;}
    const offset=instancedBufferAttribute<'vec3'>(new THREE.InstancedBufferAttribute(base,3));
    const plane=new THREE.PlaneGeometry(1,1);const g=new THREE.InstancedBufferGeometry();g.index=plane.index;g.attributes=plane.attributes;g.instanceCount=count;
    this.material=new THREE.MeshBasicNodeMaterial({color:0xeaf4ff,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    const travel=offset.add(this.wind.mul(this.clock)).add(vec3(0,this.clock.mul(-.042),0)).fract().sub(.5).mul(vec3(125,70,125));
    const turbulence=sin(this.clock.mul(.7).add(offset.y.mul(60))).mul(.9);
    const size=offset.x.mul(.055).add(.024);
    this.material.positionNode=travel.add(this.anchor).add(vec3(turbulence,0,turbulence.mul(.4))).add(this.right.mul(positionLocal.x).mul(size)).add(this.up.mul(positionLocal.y).mul(size.mul(1.6)));
    this.material.opacityNode=smoothstep(.5,.1,uv().sub(.5).length()).mul(this.opacity).mul(offset.z.mul(.5).add(.35));
    this.mesh=new THREE.Mesh(g,this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=4;sceneAdd(this.scene,this.mesh);
  }
  update(s:EnvironmentState,f:WeatherFrame,dt:number,camera:THREE.Camera){
    if(!s.paused)this.clock.value+=dt;
    const a=s.windDirection*Math.PI/180;this.wind.value.set(Math.cos(a)*s.windSpeed/125,0,Math.sin(a)*s.windSpeed/125);
    this.anchor.value.copy(camera.position);this.right.value.setFromMatrixColumn(camera.matrixWorld,0);this.up.value.setFromMatrixColumn(camera.matrixWorld,1);
    this.opacity.value=f.snow;this.mesh.visible=f.snow>.008;
  }
  setQuality(q:EnvironmentState['quality']){this.build(q);}
  dispose(){this.mesh.geometry.dispose();this.material.dispose();this.scene.remove(this.mesh);}
}
function sceneAdd(scene:THREE.Scene,mesh:THREE.Object3D){scene.add(mesh);}
