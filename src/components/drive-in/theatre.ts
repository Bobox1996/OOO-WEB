import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { lightSet, weather, windscreen } from './weather'
import { projector } from './projector'
import { touchscreen } from './touchscreen'
import type { Film } from './ProjectDeck'
import { distance, memberStops, nearby, npcPositions, shopSpawn, slideMove, stops, walkable, walkPath, type Area, type Mode, type Point, type Stop } from './walking'

type Events = {
  ready:()=>void; failure:(reason:string)=>void; proximity:(stop:Stop|null)=>void
  arrive:(stop:Stop)=>void; enlarge:()=>void; deck:()=>void; flip:(by:number)=>void
}
const projection={x:0,y:6,z:-16.5,w:17,h:9.5625}
const keys:Record<string,Point>={
  w:{x:0,z:-1},arrowup:{x:0,z:-1},s:{x:0,z:1},arrowdown:{x:0,z:1},
  a:{x:-1,z:0},arrowleft:{x:-1,z:0},d:{x:1,z:0},arrowright:{x:1,z:0},
}
const cabinetBounds:Partial<Record<Stop,T.Box3>>={
  team:new T.Box3(new T.Vector3(-13.6,0,1.3),new T.Vector3(-6.4,3.8,6.85)),
  vision:new T.Box3(new T.Vector3(7.7,0,-2.32),new T.Vector3(9.3,2.8,-.98)),
  car:new T.Box3(new T.Vector3(-1.25,0,1.6),new T.Vector3(1.25,1.95,6.4)),
  exit:new T.Box3(new T.Vector3(-1.05,0,5.02),new T.Vector3(1.05,.6,5.78)),
}
for(const [i,pos] of npcPositions.entries()){
  cabinetBounds[memberStops[i]]=new T.Box3(new T.Vector3(pos.x-.41,0,pos.z-.41),new T.Vector3(pos.x+.41,1.62,pos.z+.41))
}
function release(...roots:T.Object3D[]){
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),maps=new Set<T.Texture>()
  for(const root of roots)root.traverse(o=>{
    if(!(o instanceof T.Mesh || o instanceof T.LineSegments || o instanceof T.Sprite))return
    if(o.geometry)geometries.add(o.geometry)
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      materials.add(m)
      for(const value of Object.values(m))if(value instanceof T.Texture)maps.add(value)
    }
  })
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(m=>m.dispose())
}

export function createTheatre(host:HTMLDivElement,events:Events) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'})
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap
  const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');host.appendChild(canvas)
  const lot=new T.Scene(),shop=new T.Scene(),cam=new T.PerspectiveCamera(55,1,.028,150)
  const envs=[lightSet(lot,false,renderer),lightSet(shop,true,renderer)]
  const cabin=new T.Group(),car=new T.Group(),avatar=new T.Group()
  cabin.position.set(0,0,4);car.position.copy(cabin.position);lot.add(cabin,car,avatar)
  avatar.position.set(stops.car.x,0,stops.car.z)
  const tablet=touchscreen(cabin)
  let films:Film[]=[],index=0
  const film=projector(lot,projection,()=>tablet.draw(films,index,film.canvas))
  tablet.draw(films,index,film.canvas)
  const rain=weather(lot),glass=windscreen(cabin),cameraTarget=new T.Vector3(),goalEye=new T.Vector3(),goalAim=new T.Vector3()
  const ray=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0),pos3=new T.Vector3()
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)')
  const loader=new GLTFLoader(),pressed=new Set<string>()
  let mode:Mode='cabin',area:Area='lot',member=0,route:Point[]=[],destination:Stop|null=null,near:Stop|null=null
  let active=true,loaded=false,blocked=false,aspect=1,frame=0,elapsed=0,stride=0,previous=0,snap=true
  let lookX=0,lookY=0,down:{x:number;y:number;lookX:number;lookY:number}|null=null
  let walker:T.Object3D|undefined,leftLeg:T.Object3D|undefined,rightLeg:T.Object3D|undefined
  let leftArm:T.Object3D|undefined
  const umbrellaParts:T.Object3D[]=[]
  const people:T.Object3D[]=[],heads:(T.Object3D|undefined)[]=[],normalFacing:number[]=[]
  let stationaryShadow=true,arrivalView=1,frameAverage=0,samples=0,drawScale=1,staticRain=false
  renderer.shadowMap.autoUpdate=false
  function lightingMode(){
    cabin.visible=mode==='cabin';car.visible=!cabin.visible;avatar.visible=mode==='lot'||mode==='shop'
    umbrellaParts.forEach(o=>{o.visible=area==='lot'})
    stationaryShadow=true
  }
  async function model(file:string){
    const gltf=await loader.loadAsync('/drive-in/models/'+file+'.glb')
    const root=gltf.scene
    if(!active){release(root);return null}
    root.traverse(o=>{if(o instanceof T.Mesh){
      const m=Array.isArray(o.material)?o.material[0]:o.material
      o.castShadow=!m.transparent;o.receiveShadow=!m.transparent
    }})
    return root
  }
  async function populate(){
    await Promise.all([
      model('grounds').then(o=>{if(o)lot.add(o)}),
      model('shop-exterior').then(o=>{if(o){o.position.set(-10,0,4);lot.add(o)}}),
      model('shop-interior').then(o=>{if(o)shop.add(o)}),
      model('truck').then(o=>{if(o)car.add(o)}),
      model('cockpit').then(o=>{if(o)cabin.add(o)}),
      model('cast').then(root=>{
        if(!root)return
        walker=root.getObjectByName('Player')
        if(!walker)throw new Error('Player missing in cast')
        avatar.add(walker);walker.position.set(0,0,0)
        leftLeg=walker.getObjectByName('Player_LegL');rightLeg=walker.getObjectByName('Player_LegR');leftArm=walker.getObjectByName('Player_ArmL')
        walker.traverse(o=>{if(o.name.includes('Umbrella'))umbrellaParts.push(o)})
        for(let i=0;i<7;i++){
          const id='Member'+String(i+1).padStart(2,'0'),body=root.getObjectByName(id)
          if(!body)throw new Error(id+' missing in cast')
          const p=npcPositions[i],front=stops[memberStops[i]]
          body.position.set(p.x,0,p.z);shop.add(body);people[i]=body
          normalFacing[i]=Math.atan2(front.x-p.x,front.z-p.z);body.rotation.y=normalFacing[i];heads[i]=body.getObjectByName(id+'_Head')
        }
      }),
    ])
    if(!active)return
    lightingMode();loaded=true;snap=true;events.ready()
  }
  populate().catch(e=>{if(active)events.failure(e instanceof Error?e.message:'Model loading failed')})

  function clearRoute(){route=[];destination=null;pressed.clear()}
  function go(target:Point,stop:Stop|null=null){
    const path=walkPath(avatar.position,target,area)
    if(!path.length)return
    pressed.clear();route=path;destination=stop
  }
  function locate(){
    const next=mode===area?nearby(avatar.position,area):null
    if(next!==near){near=next;events.proximity(next)}
  }
  function move(dt:number){
    const pos=avatar.position
    let dx=0,dz=0
    for(const key of pressed){dx+=keys[key].x;dz+=keys[key].z}
    const step=dt*(area==='shop'?3:4.6)
    const next=route[0]
    if(next){dx=next.x-pos.x;dz=next.z-pos.z}
    const len=Math.hypot(dx,dz),travel=next?Math.min(len,step):step
    if(len>.0001){
      const to=slideMove(pos,dx/len*travel,dz/len*travel,area)
      const moved=distance(to,pos)
      if(moved>.00001){
        avatar.rotation.y=Math.atan2(dx,dz);pos.set(to.x,0,to.z);stride+=travel*6.3
        arrivalView=Math.max(0,arrivalView-moved*.145)
      }
    }
    if(next&&distance(pos,next)<.004)route.shift()
    const swing=len>.001&&!motion.matches?Math.sin(stride):0
    if(leftLeg)leftLeg.rotation.x=swing*.36
    if(rightLeg)rightLeg.rotation.x=-swing*.36
    if(leftArm)leftArm.rotation.x=-swing*.19
    if(walker)walker.position.y=Math.abs(swing)*.038
    locate()
    if(!route.length&&destination){
      const arrived=destination;destination=null
      if(near===arrived)events.arrive(arrived)
    }
  }
  function setMode(next:Mode){
    if(next===mode)return
    const before=mode,wasInside=area==='shop'
    mode=next;area=(next==='shop'||next==='team')?'shop':'lot'
    if(area==='shop'&&!wasInside){shop.add(avatar);avatar.position.set(shopSpawn.x,0,shopSpawn.z);avatar.rotation.y=Math.PI}
    if(area==='lot'&&wasInside){lot.add(avatar);avatar.position.set(stops.team.x,0,stops.team.z+.18);avatar.rotation.y=0}
    if(before==='cabin'&&next==='lot'){avatar.position.set(stops.car.x,0,stops.car.z);avatar.rotation.y=-Math.PI/2;arrivalView=1}
    if(next==='cabin'){lookX=0;lookY=0}
    // Don't interpolate the camera through walls or between independent sets.
    snap=wasInside!==(area==='shop')||before==='cabin'||next==='cabin'||before==='team'||next==='team'
    clearRoute();lightingMode();locate()
  }
  function pose(dt:number){
    const narrow=aspect<.9,px=avatar.position.x,pz=avatar.position.z
    let fov=52
    if(mode==='cabin'){
      goalEye.set(narrow?-.035:-.36,1.37,narrow?4.46:4.30)
      goalAim.set(goalEye.x+(narrow?.045:.27)+Math.sin(lookX)*5,goalEye.y-.14+lookY,goalEye.z-5)
      fov=narrow?Math.min(97,T.MathUtils.radToDeg(2*Math.atan(.46/aspect))):64
    }else if(mode==='lot'){
      const pull=narrow?1.18:1
      goalEye.set(px*.83,(8.4+3.4*arrivalView)*pull,pz*.86+(11.9+4.35*arrivalView)*pull)
      goalAim.set(px*.90,1.0+.95*arrivalView,pz*.90-2.55-arrivalView*2.25)
      fov=narrow?66:53
    }else if(mode==='shop'){
      const pull=narrow?1.15:1
      goalEye.set(px*.52,7.9*pull,pz*.46+8.15*pull)
      goalAim.set(px*.71,.55,pz*.72-.75)
      fov=narrow?62:50
    }else if(mode==='team'){
      const p=npcPositions[member]
      // Look along the aisle behind the till and in front of the refrigerators.
      // The customer-facing view of either clerk is blocked by merchandise.
      const side=p.x<0?1:-1
      if(member<2)goalEye.set(p.x+(narrow?2.35:2.48),1.78,p.z-(member===0?.19:.24))
      else goalEye.set(p.x+side*1.17,2.13,p.z+(narrow?2.85:2.48))
      goalAim.set(p.x,narrow?.85:1.01,p.z);fov=narrow?54:41
    }else{
      goalEye.set(8.94,1.87,narrow?2.33:1.9);goalAim.set(8.5,1.35,-1.25);fov=narrow?60:46
    }
    const alpha=snap||motion.matches?1:1-Math.exp(-dt*5.9)
    cam.position.lerp(goalEye,alpha);cameraTarget.lerp(goalAim,alpha);cam.lookAt(cameraTarget)
    cam.fov=T.MathUtils.lerp(cam.fov,fov,alpha);cam.updateProjectionMatrix();snap=false
  }
  function animate(now:number){
    if(!active||document.hidden)return
    frame=requestAnimationFrame(animate)
    const dt=previous?Math.min((now-previous)/1000,1.2):0;previous=now
    if(!loaded)return
    elapsed+=dt
    if(dt>0){
      frameAverage+=dt;samples++
      if(samples>=30){
        if(frameAverage/samples>.065&&drawScale>.73){drawScale*=.84;resize()}
        frameAverage=0;samples=0
      }
    }
    if((mode==='shop'||mode==='lot')&&!blocked){
      const steps=Math.max(1,Math.ceil(dt/.04))
      for(let i=0;i<steps;i++)move(dt/steps)
    }
    pose(dt)
    if(area==='lot'){
      if(!motion.matches||!staticRain){rain(motion.matches?0:elapsed);staticRain=motion.matches}
      glass.uniforms.time.value=motion.matches?0:elapsed
    }
    else for(let i=0;i<people.length;i++){
      const body=people[i],p=npcPositions[i],talking=mode==='team'&&member===i
      const angle=talking?Math.atan2(cam.position.x-p.x,cam.position.z-p.z):normalFacing[i]
      const diff=Math.atan2(Math.sin(angle-body.rotation.y),Math.cos(angle-body.rotation.y))
      body.rotation.y+=diff*(motion.matches?1:1-Math.exp(-dt*9))
      if(heads[i])heads[i]!.rotation.z=motion.matches?0:Math.sin(elapsed*(talking?2.8:1.25)+i)*.021
    }
    // Cache the set shadows. Refresh moving shadows at a lower rate than the viewport.
    if(stationaryShadow||((mode==='lot'||mode==='shop')&&(route.length||pressed.size)&&Math.floor(elapsed*9)!==Math.floor((elapsed-dt)*9))){
      renderer.shadowMap.needsUpdate=true;stationaryShadow=false
    }
    renderer.render(area==='shop'?shop:lot,cam)
  }
  function resize(){
    const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight)
    aspect=w/h;cam.aspect=aspect;cam.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,w<700?1.4:1.6)*drawScale);renderer.setSize(w,h,false);snap=true
  }
  const observer=new ResizeObserver(resize);observer.observe(host);resize()
  function pointerDown(e:PointerEvent){if(blocked)return;down={x:e.clientX,y:e.clientY,lookX,lookY};canvas.setPointerCapture(e.pointerId)}
  function pointerMove(e:PointerEvent){
    if(!down||mode!=='cabin'||blocked)return
    lookX=T.MathUtils.clamp(down.lookX-(e.clientX-down.x)*.0015,-.32,.32)
    lookY=T.MathUtils.clamp(down.lookY+(e.clientY-down.y)*.006,-.48,.48)
  }
  function pointerUp(e:PointerEvent){
    if(!down)return
    const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null
    if(blocked||moved>8||!loaded)return
    const b=canvas.getBoundingClientRect()
    ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),cam)
    if(mode==='cabin'){
      const hit=ray.intersectObject(tablet.mesh)[0]
      if(hit?.uv){if(hit.uv.y<.15&&hit.uv.x<.25)events.flip(-1);else if(hit.uv.y<.15&&hit.uv.x>.75)events.flip(1);else events.deck();return}
      if(ray.intersectObject(film.screen).length)events.enlarge()
      return
    }
    if(mode!==area)return
    const selectable:readonly Stop[]=area==='lot'?['team','vision','car']:['exit',...memberStops]
    let nearest:Stop|null=null,best=Infinity
    for(const id of selectable){
      const hit=ray.ray.intersectBox(cabinetBounds[id]!,pos3)
      if(hit&&hit.distanceTo(cam.position)<best){nearest=id;best=hit.distanceTo(cam.position)}
    }
    if(nearest){go(stops[nearest],nearest);return}
    const hit=ray.ray.intersectPlane(ground,pos3)
    if(hit&&walkable(hit.x,hit.z,area))go({x:hit.x,z:hit.z})
  }
  function up(e:KeyboardEvent){pressed.delete(e.key.toLowerCase())}
  function key(e:KeyboardEvent){
    const k=e.key.toLowerCase()
    if(!blocked&&mode===area&&keys[k]&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
      e.preventDefault();pressed.add(k);route=[];destination=null
    }
  }
  function resetInput(){pressed.clear();down=null}
  function visibility(){cancelAnimationFrame(frame);resetInput();previous=0;if(!document.hidden)frame=requestAnimationFrame(animate)}
  function lost(e:Event){e.preventDefault();events.failure('WebGL context lost')}
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',resetInput)
  canvas.addEventListener('webglcontextlost',lost);window.addEventListener('keydown',key);window.addEventListener('keyup',up);window.addEventListener('blur',resetInput)
  document.addEventListener('visibilitychange',visibility);visibility()
  return {
    setMode, travel(id:Stop){if(mode===area)go(stops[id],id)},
    setMember(i:number){member=T.MathUtils.clamp(i,0,6)},
    project(all:Film[],i:number){films=all;index=i;const item=films[i];film.set(item?.cover?.url||null,item?.title||'Intermission')},
    pause(value:boolean){blocked=value;if(value)resetInput()},
    dispose(){
      active=false;cancelAnimationFrame(frame);observer.disconnect()
      canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',resetInput);canvas.removeEventListener('webglcontextlost',lost)
      window.removeEventListener('keydown',key);window.removeEventListener('keyup',up);window.removeEventListener('blur',resetInput)
      document.removeEventListener('visibilitychange',visibility);film.dispose();release(lot,shop);envs.forEach(e=>e.dispose());renderer.dispose();canvas.remove()
    },
  }
}
export type Theatre=ReturnType<typeof createTheatre>
