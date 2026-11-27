import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CameraMode } from './types';
export type MoveDirection='forward'|'backward'|'left'|'right';
export class CameraSystem {
  camera=new THREE.PerspectiveCamera(46,1,.15,75000);
  mode:CameraMode='Cabin';controls:OrbitControls;
  private desired=new THREE.Vector3();private desiredTarget=new THREE.Vector3();private transitioning=false;
  private yaw=0;private pitch=0;private dragging=false;private previous=new THREE.Vector2();
  private keys=new Set<string>();private velocity=new THREE.Vector3();
  private touchKeys=new Set<MoveDirection>();
  constructor(private canvas:HTMLCanvasElement,private heightAt:(x:number,z:number)=>number){
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.07;
    this.controls.minDistance=9;this.controls.maxDistance=220;this.controls.maxPolarAngle=Math.PI*.485;
    this.controls.enablePan=false;this.controls.zoomSpeed=.65;this.controls.rotateSpeed=.5;
    this.camera.position.set(30,12,-47);this.controls.target.set(-2,12,5);this.controls.update();
    canvas.addEventListener('pointerdown',this.pointerDown);canvas.addEventListener('pointermove',this.pointerMove);window.addEventListener('pointerup',this.pointerUp);
    window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.clearInput);
    this.controls.addEventListener('start',this.onOrbitStart);
  }
  private onOrbitStart=()=>{if(this.mode!=='First Person')this.transitioning=false;};
  private keyDown=(e:KeyboardEvent)=>{if((e.target as HTMLElement).matches('input,select,textarea,button'))return;this.keys.add(e.code);if(this.mode==='First Person'&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();};
  private keyUp=(e:KeyboardEvent)=>{this.keys.delete(e.code);};
  private clearInput=()=>{this.keys.clear();this.touchKeys.clear();this.dragging=false;};
  private pointerDown=(e:PointerEvent)=>{if(this.mode!=='First Person')return;this.dragging=true;this.previous.set(e.clientX,e.clientY);this.canvas.setPointerCapture(e.pointerId);};
  private pointerMove=(e:PointerEvent)=>{if(!this.dragging||this.mode!=='First Person')return;this.yaw-=(e.clientX-this.previous.x)*.003;this.pitch=THREE.MathUtils.clamp(this.pitch-(e.clientY-this.previous.y)*.003,-1.35,1.35);this.previous.set(e.clientX,e.clientY);};
  private pointerUp=()=>{this.dragging=false;};
  setMove(direction:MoveDirection,pressed:boolean){if(pressed)this.touchKeys.add(direction);else this.touchKeys.delete(direction);}
  setMode(mode:CameraMode){
    this.mode=mode;this.transitioning=true;this.clearInput();this.velocity.set(0,0,0);
    this.controls.enabled=mode!=='First Person';
    if(mode==='Landscape'){this.desired.set(920,680,-1150);this.desiredTarget.set(0,-60,1700);this.controls.maxDistance=17000;this.controls.minDistance=80;this.controls.maxPolarAngle=Math.PI*.49;}
    else if(mode==='First Person'){this.desired.set(7,this.heightAt(7,-8)+1.7,-8);this.desiredTarget.set(0,2.6,-1);this.yaw=2.5;this.pitch=.03;}
    else {this.desired.set(mode==='Orbit'?21:30,mode==='Orbit'?11:12,mode==='Orbit'?-30:-47);this.desiredTarget.set(-2,mode==='Orbit'?3.4:12,5);this.controls.maxDistance=280;this.controls.minDistance=10;this.controls.maxPolarAngle=mode==='Cabin'?Math.PI*.51:Math.PI*.485;}
  }
  update(dt:number,fov:number){
    this.camera.fov=fov;this.camera.updateProjectionMatrix();
    if(this.transitioning){
      const a=1-Math.exp(-dt*2.4);this.camera.position.lerp(this.desired,a);this.controls.target.lerp(this.desiredTarget,a);this.camera.lookAt(this.controls.target);
      if(this.camera.position.distanceTo(this.desired)<.08){this.transitioning=false;if(this.mode==='First Person'){const d=new THREE.Vector3().subVectors(this.desiredTarget,this.camera.position).normalize();this.yaw=Math.atan2(-d.x,-d.z);this.pitch=Math.asin(d.y);}}
      return;
    }
    if(this.mode!=='First Person'){
      this.controls.update();const ground=this.heightAt(this.camera.position.x,this.camera.position.z)+1.7;
      if(this.camera.position.y<ground)this.camera.position.y=ground;
      return;
    }
    const forward=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp')||this.touchKeys.has('forward'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown')||this.touchKeys.has('backward'));
    const strafe=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight')||this.touchKeys.has('right'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft')||this.touchKeys.has('left'));
    const movement=new THREE.Vector3(strafe,0,-forward);if(movement.length()>1)movement.normalize();movement.applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw).multiplyScalar(this.keys.has('ShiftLeft')?4.5:2.3);
    this.velocity.lerp(movement,1-Math.exp(-dt*9));const next=this.camera.position.clone().addScaledVector(this.velocity,dt);
    // Walkable ridge radius, steep-slope and building collision; the landscape remains continuous beyond it.
    const ground=this.heightAt(next.x,next.z),here=this.heightAt(this.camera.position.x,this.camera.position.z);
    const inBuilding=Math.abs(next.x)<4.25&&Math.abs(next.z)<5.15;
    if(!inBuilding&&Math.hypot(next.x,next.z)<280&&Math.abs(ground-here)<Math.max(.35,this.velocity.length()*dt*1.4)){this.camera.position.x=next.x;this.camera.position.z=next.z;}
    const y=this.heightAt(this.camera.position.x,this.camera.position.z)+1.7;
    this.camera.position.y=THREE.MathUtils.lerp(this.camera.position.y,y,1-Math.exp(-dt*14));
    this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);
  }
  resize(w:number,h:number){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  dispose(){this.controls.dispose();this.canvas.removeEventListener('pointerdown',this.pointerDown);this.canvas.removeEventListener('pointermove',this.pointerMove);window.removeEventListener('pointerup',this.pointerUp);window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.clearInput);}
}
