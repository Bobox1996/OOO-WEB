import * as T from 'three'
import { buildLot } from './scenery'
import { cockpit } from './cockpit'
import { figure, truck } from './vehicles'
import { projector } from './projector'
import { group, seeded } from './geometry'
import { distance, nearby, stops, walkable, walkPath, type Mode, type Point, type Stop } from './walking'

export function createTheatre(host:HTMLDivElement,events:{
  proximity:(s:Stop|null)=>void; arrive:(s:Stop)=>void; enlarge:()=>void; failure:()=>void
}) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'})
  renderer.autoClear=false
  host.appendChild(renderer.domElement)
  const canvas=renderer.domElement; canvas.setAttribute('aria-hidden','true')
  const scene=new T.Scene(),cam=new T.PerspectiveCamera(50,1,.08,180)
  const lot=buildLot(scene),film=projector(scene,lot.projection),cabin=cockpit(),car=truck(scene)
  const visitor=figure(scene,true),actors=group(scene,-9,.36,7.62)
  let attendant=figure(actors,false),changeAt=-2
  const player=visitor.g;player.position.set(stops.car.x,0,stops.car.z)
  let mode:Mode='cabin',route:Point[]=[],destination:Stop|null=null,closeTo:Stop|null=null
  const keyboard=new Set<string>(),clock=new T.Clock(false)
  let elapsed=0,aspect=1,frameId=0,disposed=false,lastMode:Mode|null=null,walkCycle=0
  const aim=new T.Vector3(),desired=new T.Vector3(),target=new T.Vector3(),look=new T.Vector3()
  const rainCount=820,coords=new Float32Array(rainCount*6),r=seeded(360)
  const drops=new Float32Array(rainCount*4)
  for(let i=0;i<rainCount;i++){drops[i*4]=(r()-.5)*40;drops[i*4+1]=r()*16;drops[i*4+2]=r()*42-22;drops[i*4+3]=.12+r()*.22}
  const geo=new T.BufferGeometry(),attr=new T.BufferAttribute(coords,3);attr.setUsage(T.DynamicDrawUsage)
  geo.setAttribute('position',attr)
  const rain=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#bbd2db',opacity:.33,transparent:true,depthWrite:false}));rain.frustumCulled=false;scene.add(rain)
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)')
  const ray=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0)
  const points:Record<Stop,T.Box3>={
    team:new T.Box3(new T.Vector3(-11.4,0,4.4),new T.Vector3(-6.6,3.6,7.8)),
    vision:new T.Box3(new T.Vector3(7.5,0,-2.4),new T.Vector3(9.5,2.8,-.9)),
    car:new T.Box3(new T.Vector3(-1.44,0,1.12),new T.Vector3(1.44,2.16,6.85)),
  }
  function go(end:Point,stop:Stop|null=null) {
    route=walkPath(player.position,end);destination=route.length?stop:null
  }
  function tap(e:PointerEvent) {
    const bounds=canvas.getBoundingClientRect()
    const ndc=new T.Vector2((e.clientX-bounds.left)/bounds.width*2-1,1-(e.clientY-bounds.top)/bounds.height*2)
    ray.setFromCamera(ndc,cam)
    if(mode==='cabin'){
      const hit=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),16),new T.Vector3())
      if(hit && Math.abs(hit.x)<7.2 && Math.abs(hit.y-5.6)<3.68)events.enlarge()
      return
    }
    if(mode!=='lot')return
    let hitStop:Stop|null=null,closest=Infinity
    for(const id of Object.keys(points) as Stop[]){
      const hit=ray.ray.intersectBox(points[id],new T.Vector3())
      if(hit && hit.distanceTo(cam.position)<closest){closest=hit.distanceTo(cam.position);hitStop=id}
    }
    if(hitStop){go(stops[hitStop],hitStop);return}
    const pos=ray.ray.intersectPlane(ground,new T.Vector3())
    if(pos && walkable(pos.x,pos.z))go(pos)
  }
  const keyMap:Record<string,[number,number]>={w:[0,-1],arrowup:[0,-1],s:[0,1],arrowdown:[0,1],a:[-1,0],arrowleft:[-1,0],d:[1,0],arrowright:[1,0]}
  function onKey(e:KeyboardEvent) {
    const key=e.key.toLowerCase()
    if(e.type==='keyup'){keyboard.delete(key);return}
    if(mode==='lot' && keyMap[key] && !e.metaKey && !e.ctrlKey && !document.querySelector('dialog[open]')){
      e.preventDefault();keyboard.add(key);route=[];destination=null
    }
  }
  function move(dt:number) {
    const pos=player.position
    let dx=0,dz=0
    for(const key of keyboard){dx+=keyMap[key][0];dz+=keyMap[key][1]}
    let step=dt*4.2
    if(route.length){
      const next=route[0];dx=next.x-pos.x;dz=next.z-pos.z
      step=Math.min(step,Math.hypot(dx,dz))
      if(step>=distance(pos,next)-.001)route.shift()
    }
    const len=Math.hypot(dx,dz)
    if(len>.001){
      dx/=len;dz/=len
      if(walkable(pos.x+dx*step,pos.z))pos.x+=dx*step
      if(walkable(pos.x,pos.z+dz*step))pos.z+=dz*step
      player.rotation.y=Math.atan2(dx,dz);walkCycle+=dt*12
    }
    visitor.legs.forEach((leg,i)=>leg.rotation.x=len>.001?Math.sin(walkCycle+i*Math.PI)*.45:0)
    visitor.upper.position.y=len>.001 && !motion.matches?Math.abs(Math.sin(walkCycle))*.055:0
    const near=nearby(pos)
    if(near!==closeTo){closeTo=near;events.proximity(near)}
    if(!route.length && destination){const id=destination;destination=null;if(near===id)events.arrive(id)}
  }
  function cameraPose(dt:number,initial=false){
    const narrow=aspect<.9
    let fov=49
    if(mode==='cabin'){
      fov=Math.max(48,T.MathUtils.radToDeg(2*Math.atan(.406/aspect)))
      desired.set(-.32,1.8,4.65);target.set(-.1,narrow?-1.9:2.42,-16)
    }else if(mode==='lot'){
      const px=player.position.x,pz=player.position.z
      const pull=narrow?1.16:1
      desired.set(px*.61,10.4*pull,pz*.76+12.5*pull);target.set(px*.81,.45,pz*.89-1.4)
      fov=54
    }else if(mode==='team'){
      desired.set(-8.95,2.12,narrow?12.5:11.4);target.set(-9,1.67,7.39);fov=46
    }else{
      desired.set(8.82,1.87,narrow?3.5:2.45);target.set(8.5,1.48,-1.1);fov=46
    }
    const blend=initial||motion.matches?1:1-Math.exp(-dt*(mode==='lot'?5:7))
    cam.position.lerp(desired,blend);aim.lerp(target,blend);cam.lookAt(aim)
    cam.fov=T.MathUtils.lerp(cam.fov,fov,blend);cam.updateProjectionMatrix()
  }
  function frame() {
    if(disposed || document.hidden)return
    frameId=requestAnimationFrame(frame)
    const dt=Math.min(clock.getDelta(),.06);elapsed+=dt
    if(mode==='lot')move(dt)
    cameraPose(dt,lastMode===null || (mode==='cabin' && lastMode!=='cabin'))
    lastMode=mode;car.visible=mode!=='cabin';player.visible=mode==='lot'
    const phase=Math.min(1,(elapsed-changeAt)/.56)
    actors.position.x=-9+(1-phase)*(1-phase)*1.4
    attendant.upper.position.y=motion.matches?0:Math.sin(elapsed*1.7)*.015
    for(let i=0;i<rainCount;i++){
      const a=i*4,b=i*6,t=motion.matches?0:elapsed
      const y=((drops[a+1]-t*(6.8+drops[a+3]*9))%16+16)%16
      const x=drops[a]+(16-y)*.115
      coords[b]=x;coords[b+1]=y;coords[b+2]=drops[a+2]
      coords[b+3]=x+.04;coords[b+4]=y-drops[a+3];coords[b+5]=drops[a+2]
    }
    attr.needsUpdate=true
    renderer.clear();renderer.render(scene,cam)
    if(mode==='cabin'){renderer.clearDepth();renderer.render(cabin.scene,cabin.camera)}
  }
  function resize(){
    const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight)
    aspect=w/h;cam.aspect=aspect;cam.updateProjectionMatrix();cabin.resize(aspect)
    renderer.setPixelRatio(Math.min(devicePixelRatio, w<700?1.65:1.75))
    renderer.setSize(w,h,false)
  }
  function clearKeys(){keyboard.clear()}
  function visibility(){
    cancelAnimationFrame(frameId);clearKeys();clock.stop()
    if(!document.hidden){clock.start();frame()}
  }
  function contextLoss(e:Event){e.preventDefault();events.failure()}
  const observer=new ResizeObserver(resize);observer.observe(host);resize()
  canvas.addEventListener('pointerup',tap);canvas.addEventListener('webglcontextlost',contextLoss)
  window.addEventListener('keydown',onKey);window.addEventListener('keyup',onKey);window.addEventListener('blur',clearKeys)
  document.addEventListener('visibilitychange',visibility);visibility()
  // Dispose every unique GPU resource belonging to this scene.
  function release(root:T.Object3D){
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),maps=new Set<T.Texture>()
    root.traverse(o=>{
      if(!(o instanceof T.Mesh || o instanceof T.LineSegments || o instanceof T.Sprite))return
      if(o.geometry)geometries.add(o.geometry)
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        materials.add(m);if('map' in m && m.map instanceof T.Texture)maps.add(m.map)
      }
    })
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(m=>m.dispose())
  }
  return {
    setMode(next:Mode){
      if(next===mode)return
      if(mode==='cabin' && next==='lot'){player.position.set(stops.car.x,0,stops.car.z);player.rotation.y=-Math.PI/2}
      mode=next;route=[];destination=null;clearKeys()
      closeTo=next==='lot'?nearby(player.position):null;events.proximity(closeTo)
    },
    travel(id:Stop){if(mode==='lot')go(stops[id],id)},
    setMember(i:number){
      release(attendant.g);attendant.g.removeFromParent();attendant=figure(actors,false,i)
      if(!motion.matches)changeAt=elapsed
    },
    project:film.set,
    dispose(){
      disposed=true;cancelAnimationFrame(frameId);observer.disconnect()
      canvas.removeEventListener('pointerup',tap);canvas.removeEventListener('webglcontextlost',contextLoss)
      window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKey);window.removeEventListener('blur',clearKeys)
      document.removeEventListener('visibilitychange',visibility);film.dispose()
      release(scene);release(cabin.scene);renderer.dispose();canvas.remove()
    },
  }
}
export type Theatre=ReturnType<typeof createTheatre>
