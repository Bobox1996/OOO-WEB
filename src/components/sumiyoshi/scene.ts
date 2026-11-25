import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { cameraDirector, opening, type View } from './camera'
import { bottleLabel, cafeWindowRain, furnishLight, rainField, television } from './objects'
import { rainCoast } from './rainCoast'
import { createCanopyBreeze } from './canopyBreeze'
import { screenSurface } from './screenSurface'
import { artworkWidth, loungeViewport, pixelViewport } from './pixelViewport'
import { applyLoungeInk } from './loungeInk'
import { areas, stops, homeSpawn, forestCenterX, npcPositions, memberStops, nearby, walkable, walkPath, slideMove, distance, type Point, type Stop } from './world'

type Controls={
  ready:()=>void;failure:(err:string)=>void;near:(id:Stop|null)=>void;arrive:(id:Stop)=>void;
  focus:()=>void;flip:(n:number)=>void;moving:()=>void;label:()=>void
}
const vectors:Record<string,[number,number]>={w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],arrowup:[0,-1],arrowdown:[0,1],arrowleft:[-1,0],arrowright:[1,0]}
function free(roots:T.Object3D[]){
  const geometry=new Set<T.BufferGeometry>(),material=new Set<T.Material>(),textures=new Set<T.Texture>()
  for(const root of roots) root.traverse(o=>{
    if(o instanceof T.Mesh||o instanceof T.LineSegments){
      geometry.add(o.geometry)
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        material.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v)
      }
    }
  })
  geometry.forEach(g=>g.dispose());material.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())
}
export function createStreetGame(host:HTMLDivElement,events:Controls,vision:string){
  const renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'})
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false
  const canvas=renderer.domElement;host.appendChild(canvas);canvas.setAttribute('aria-hidden','true')
  const scenes={home:new T.Scene(),street:new T.Scene(),cafe:new T.Scene()}
  const keyLights={home:furnishLight(scenes.home,'home'),street:furnishLight(scenes.street,'street'),cafe:furnishLight(scenes.cafe,'cafe')}
  const coast=rainCoast(scenes.home)
  const streetRain=rainField(scenes.street)
  const cafeGlass=cafeWindowRain(scenes.cafe)
  const breeze=createCanopyBreeze()
  const camera=new T.PerspectiveCamera(48,1,.035,95),director=cameraDirector(camera),tv=television(scenes.home)
  const tvDocument=screenSurface(tv.face,camera)
  const avatar=new T.Group();scenes.home.add(avatar);avatar.position.set(homeSpawn.x,0,homeSpawn.z)
  const bottleScene=new T.Scene(),bottleRig=new T.Group(),bottleCam=new T.PerspectiveCamera(36,1,.015,5)
  bottleScene.add(bottleRig);bottleScene.add(new T.HemisphereLight('#fff0d7','#e6b883',2.05))
  const glint=new T.DirectionalLight('#ffe8d1',2.4);glint.position.set(-2,3,4);bottleScene.add(glint)
  const backlight=new T.DirectionalLight('#e4fbff',2);backlight.position.set(1,.8,-1.8);bottleScene.add(backlight)
  bottleLabel(bottleRig,vision)
  const loader=new GLTFLoader(),motion=window.matchMedia('(prefers-reduced-motion: reduce)')
  const ray=new T.Raycaster(),floor=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3(),box=new T.Box3()
  const held=new Set<string>(),npcs:T.Object3D[]=[],poses=new Map<string,T.Object3D>()
  const position=new T.Vector3()
  let player:T.Object3D|undefined,seated:T.Object3D|undefined,walking=false
  let seatedFrames:T.Mesh[]=[]
  const cafeCeiling:T.Object3D[]=[]
  let view:View=opening,route:Point[]=[],goal:Stop|null=null,nearId:Stop|null=null
  let disposed=false,ready=false,blocked=false,resizePending=true,frame=0,then=0,time=0,stride=0
  const rasterSetting=new URLSearchParams(location.search).get('pixels')
  const rasterWidth=artworkWidth(rasterSetting)
  const explicitRaster=rasterSetting===String(rasterWidth)
  let pointer:{x:number;y:number;angle:number}|null=null,bottleAngle=0,remotePulse=0
  let nearGround:T.Mesh|undefined
  const paintAnisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy())
  function model(file:string,attach:(obj:T.Group)=>void){
    return loader.loadAsync('/sumiyoshi/models/'+file+'.glb').then(g=>{
      if(disposed){free([g.scene]);return}
      const environment=file!=='people'&&file!=='cola'
      const paint=new Set<T.Texture>()
      const finishes=new Set<T.MeshStandardMaterial>()
      g.scene.traverse(o=>{if(o instanceof T.Mesh){
        const materials=Array.isArray(o.material)?o.material:[o.material]
        const m=materials[0]
        o.castShadow=!m.transparent&&!m.name.includes('Painted botanical sprays');o.receiveShadow=!m.transparent
        if(environment)for(const material of materials){
          if(file==='house'&&material instanceof T.MeshStandardMaterial)finishes.add(material)
          if(material.map)paint.add(material.map)
          if(material.emissiveMap)paint.add(material.emissiveMap)
        }
      }})
      finishes.forEach(applyLoungeInk)
      // Keep nearby texels sharp; filter receding leaf clusters, timber and fine metalwork
      // across mip levels so oblique views and slow tracking do not sparkle.
      for(const map of paint){
        map.magFilter=T.NearestFilter;map.minFilter=T.LinearMipmapLinearFilter
        map.anisotropy=paintAnisotropy;map.needsUpdate=true
      }
      if(file==='street'||file==='cafe-front')breeze.attach(g.scene)
      attach(g.scene)
    })
  }
  function applyVisibility(){
    avatar.visible=view.mode==='walk'
    cafeCeiling.forEach(o=>{o.visible=view.mode!=='walk'||!director.elevated})
    if(seated)seated.visible=view.mode==='seated'
    renderer.shadowMap.needsUpdate=true
  }
  const assets=[
    coast.ready,
    model('house',g=>scenes.home.add(g)),model('street',g=>scenes.street.add(g)),model('cafe-front',g=>{g.position.x=forestCenterX;scenes.street.add(g)}),
    model('cafe',g=>{
      g.traverse(o=>{
        if(o.name.startsWith('Cutaway'))o.visible=false
        if(o.name.startsWith('Ceiling_')){o.castShadow=false;cafeCeiling.push(o)}
      })
      scenes.cafe.add(g)
    }),model('cola',g=>bottleRig.add(g)),
    model('people',g=>{
      player=g.getObjectByName('Player');seated=g.getObjectByName('PlayerSeated')
      if(!player||!seated)throw new Error('Missing player pose')
      avatar.add(player);player.position.set(0,0,0)
      const inks=new Map<T.Material,T.MeshBasicMaterial>()
      for(const body of [player,seated,...memberStops.map((_,i)=>g.getObjectByName('Member'+String(i+1).padStart(2,'0')))]){
        body?.traverse(o=>{
          if(!(o instanceof T.Mesh)||!(o.material instanceof T.MeshStandardMaterial)||!o.material.map)return
          const original=o.material
          let ink=inks.get(original)
          if(!ink){
            const map=original.map!
            map.magFilter=T.NearestFilter;map.minFilter=T.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true
            ink=new T.MeshBasicMaterial({map,alphaTest:.5,side:T.DoubleSide,toneMapped:false})
            inks.set(original,ink)
          }
          o.material=ink;o.castShadow=true
        })
      }
      inks.forEach((_,material)=>material.dispose())
      for(const prefix of ['Player_','Rain_']){
        const names=['Front','StrideA','StrideB','Side','AwayA','AwayB','Back']
        if(prefix==='Rain_')names.push('Approach')
        for(const name of names){
          const pose=prefix+name,drawing=player.getObjectByName(pose)
          if(!drawing)throw new Error('Missing player drawing '+pose)
          poses.set(pose,drawing)
        }
      }
      seatedFrames=['Seated_Rest','Seated_Change'].map(name=>seated!.getObjectByName(name) as T.Mesh)
      scenes.home.add(seated);seated.position.set(.72,.48,1.27)
      for(let i=0;i<memberStops.length;i++){
        const name='Member'+String(i+1).padStart(2,'0'),body=g.getObjectByName(name)
        if(!body)throw new Error('Missing '+name)
        const p=npcPositions[i]
        scenes.cafe.add(body);body.position.set(p.x,0,p.z)
        npcs[i]=body
      }
    }),
  ]
  Promise.all(assets).then(()=>{if(!disposed){applyVisibility();ready=true;events.ready()}}).catch(e=>{if(!disposed)events.failure(String(e))})
  function proximity(){
    const next=view.mode==='walk'?nearby(view.area,avatar.position):null
    if(next!==nearId){nearId=next;events.near(next)}
  }
  function clear(){route=[];goal=null;held.clear();if(nearGround)nearGround.visible=false}
  function setView(next:View,spawn?:Point){
    const previous=view;view=next;clear()
    if(isLoungeRaster(previous)!==isLoungeRaster(next))resizePending=true
    if(next.area!==previous.area){scenes[next.area].add(avatar);director.cut()}
    if(spawn){avatar.position.set(spawn.x,0,spawn.z);avatar.rotation.y=next.area==='street'?0:Math.PI}
    if(next.mode==='walk'&&(previous.mode==='seated'||previous.mode==='focus')){avatar.position.set(homeSpawn.x,0,homeSpawn.z);avatar.rotation.y=Math.PI*.5}
    if(next.mode==='bottle')bottleAngle=0
    if(next.mode==='talk'||previous.mode==='talk')director.cut()
    applyVisibility();proximity()
  }
  function walkTo(p:Point,id:Stop|null){
    if(view.mode!=='walk'||!ready)return false
    const path=walkPath(view.area,avatar.position,p)
    if(!path.length)return false
    clear();route=path;goal=id
    if(!id){
      if(!nearGround){nearGround=new T.Mesh(new T.RingGeometry(.14,.17,30),new T.MeshBasicMaterial({color:'#f1eacb',opacity:.8,transparent:true,depthWrite:false}));nearGround.rotation.x=-Math.PI/2}
      scenes[view.area].add(nearGround);nearGround.position.set(p.x,.053,p.z);nearGround.visible=true;events.moving()
    }
    return true
  }
  function walk(dt:number){
    const p=avatar.position,target=route[0]
    let dx=0,dz=0
    for(const key of held){dx+=vectors[key][0];dz+=vectors[key][1]}
    if(target){dx=target.x-p.x;dz=target.z-p.z}
    const len=Math.hypot(dx,dz),step=dt*(view.area==='street'?4.2:2.95)
    if(len>.0001){
      const scale=(target?Math.min(step,len):step)/len,to=slideMove(view.area,p,dx*scale,dz*scale)
      const moved=distance(to,p)
      if(moved>.00001){p.set(to.x,0,to.z);avatar.rotation.y=Math.atan2(dx,dz);stride+=moved*7}
    }
    if(target&&distance(target,p)<.012)route.shift()
    if(!route.length&&nearGround)nearGround.visible=false
    walking=len>.001
    proximity()
    if(!route.length&&goal){
      const arrival=goal;goal=null
      if(distance(p,stops[arrival].approach)<.14)events.arrive(arrival)
    }
  }
  function keydown(e:KeyboardEvent){
    const k=e.key.toLowerCase()
    if(blocked||e.metaKey||e.ctrlKey||e.altKey||view.mode!=='walk'||!vectors[k])return
    e.preventDefault();held.add(k);route=[];goal=null;events.moving()
  }
  function keyup(e:KeyboardEvent){held.delete(e.key.toLowerCase())}
  function reset(){held.clear();pointer=null}
  function down(e:PointerEvent){if(!blocked){pointer={x:e.clientX,y:e.clientY,angle:bottleAngle};canvas.setPointerCapture(e.pointerId)}}
  function drag(e:PointerEvent){if(pointer&&!blocked&&view.mode==='bottle')bottleAngle=pointer.angle+(e.clientX-pointer.x)*.012}
  function tap(e:PointerEvent){
    if(!pointer)return
    const delta=Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y);pointer=null
    if(delta>9||blocked||!ready)return
    const r=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera)
    if(view.mode==='bottle'){events.label();return}
    if(view.mode==='seated'||view.mode==='focus'){
      if(ray.intersectObject(tv.face).length){events.focus();return}
      if(view.mode==='seated'){
        const drawing=seatedFrames.find(o=>o.visible)
        if(drawing){
          const contact=ray.intersectObject(drawing)[0]
          if(contact?.uv){
            const uv=drawing.geometry.getAttribute('uv')
            const u=(contact.uv.x-uv.getX(0))/(uv.getX(1)-uv.getX(0))
            const v=(contact.uv.y-uv.getY(0))/(uv.getY(2)-uv.getY(0))
            if(u<.41&&v>.37&&v<.84)events.flip(1)
          }
        }
      }
      return
    }
    if(view.mode!=='walk')return
    let choice:Stop|null=null,closest=Infinity
    for(const id of areas[view.area].stops){
      const s=stops[id],[l,r,b,f]=s.hitbox
      box.min.set(l,.005,b);box.max.set(r,s.action.kind==='door'?2.15:s.action.kind==='sofa'?.94:s.action.kind==='vision'?2.12:1.78,f)
      if(ray.ray.intersectBox(box,hit)&&hit.distanceTo(camera.position)<closest){closest=hit.distanceTo(camera.position);choice=id}
    }
    if(choice){walkTo(stops[choice].approach,choice);return}
    if(ray.ray.intersectPlane(floor,hit)&&walkable(view.area,hit))walkTo({x:hit.x,z:hit.z},null)
  }
  function isLoungeRaster(current:View){
    return !explicitRaster&&current.area==='home'&&current.mode!=='focus'
  }
  function resize(){
    const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight)
    if(camera.aspect!==w/h)director.cut()
    camera.aspect=w/h;camera.updateProjectionMatrix();bottleCam.aspect=w/h
    bottleCam.position.set(.0,.158,w/h<.8?.79:.63);bottleCam.lookAt(0,.145,0);bottleCam.updateProjectionMatrix()
    const raster=isLoungeRaster(view)?loungeViewport(w,h):pixelViewport(w,h,rasterWidth)
    renderer.setSize(raster.width,raster.height,false)
  }
  function render(now:number){
    if(disposed||document.hidden)return
    frame=requestAnimationFrame(render)
    const dt=then?Math.min((now-then)/1000,.9):0;then=now
    if(!ready)return
    if(resizePending){resizePending=false;resize()}
    time+=dt
    if(view.mode==='walk'&&!blocked){
      const steps=Math.max(1,Math.ceil(dt/.035))
      for(let i=0;i<steps;i++)walk(dt/steps)
    }
    director.frame(view,avatar.position,dt,motion.matches,tvDocument.attached,canvas.width)
    if(tvDocument.attached&&view.mode==='focus')tvDocument.place(canvas.clientWidth,canvas.clientHeight)
    const weatherTime=motion.matches?0:time
    if(view.area==='home')coast.update(weatherTime)
    else if(view.area==='street')streetRain(weatherTime)
    else cafeGlass(weatherTime)
    breeze.update(time,motion.matches)
    if(view.area==='street'){
      keyLights.street.target.position.x=avatar.position.x;keyLights.street.position.x=avatar.position.x-5
    }
    if(view.area==='cafe')npcs.forEach((body,i)=>{
      const p=npcPositions[i]
      body.rotation.y=Math.atan2(camera.position.x-p.x,camera.position.z-p.z)
      body.scale.x=i%3===1?-1:1
    })
    if(player&&view.mode==='walk'){
      avatar.getWorldPosition(position)
      const yaw=Math.atan2(camera.position.x-position.x,camera.position.z-position.z)
      const heading=avatar.rotation.y-yaw
      player.rotation.y=-heading
      const side=Math.sin(heading),front=Math.cos(heading),step=Math.sin(stride)
      const gait=walking&&!motion.matches
      let pose='Front'
      if(Math.abs(side)>.59)pose=!gait||Math.abs(step)<.35?'Side':step>0?'StrideA':'StrideB'
      else if(front<0)pose=!gait||Math.abs(step)<.35?'Back':step>0?'AwayA':'AwayB'
      else if(view.area==='street'&&gait&&Math.abs(step)>.45)pose='Approach'
      pose=(view.area==='street'?'Rain_':'Player_')+pose
      poses.forEach((drawing,name)=>{drawing.visible=name===pose;drawing.scale.x=side<-.2?-1:1})
      player.position.y=gait?Math.abs(step)*.025:0
    }
    if(seated&&view.mode==='seated'){
      seated.rotation.y=Math.atan2(camera.position.x-seated.position.x,camera.position.z-seated.position.z)
      remotePulse=Math.max(0,remotePulse-dt*2.8)
      seatedFrames.forEach((drawing,index)=>{drawing.visible=index===(remotePulse>.08&&!motion.matches?1:0)})
    }
    if(view.mode==='walk'&&(held.size||route.length)&&Math.floor(time*7)!==Math.floor((time-dt)*7))renderer.shadowMap.needsUpdate=true
    renderer.autoClear=true;renderer.render(scenes[view.area],camera)
    if(view.mode==='bottle'){
      renderer.autoClear=false;renderer.clearDepth();bottleRig.rotation.y=bottleAngle
      bottleRig.rotation.z=.06;bottleRig.position.y=.014;renderer.render(bottleScene,bottleCam)
    }
  }
  // Resizing clears WebGL's drawing buffer. Redraw in the same animation frame.
  const observe=new ResizeObserver(()=>{resizePending=true});observe.observe(host)
  function visibility(){cancelAnimationFrame(frame);then=0;reset();if(!document.hidden)frame=requestAnimationFrame(render)}
  function lost(e:Event){e.preventDefault();events.failure('WebGL context lost')}
  const listeners:[EventTarget,string,EventListener][]=[
    [canvas,'pointerdown',down as EventListener],[canvas,'pointermove',drag as EventListener],[canvas,'pointerup',tap as EventListener],[canvas,'pointercancel',reset],
    [window,'keydown',keydown as EventListener],[window,'keyup',keyup as EventListener],[window,'blur',reset],
    [document,'visibilitychange',visibility],[canvas,'webglcontextlost',lost],
  ]
  listeners.forEach(([el,name,fn])=>el.addEventListener(name,fn));visibility()
  return {
    setView,go(id:Stop){return walkTo(stops[id].approach,id)},
    setFilm(url:string|null,title:string){tv.set(url,title);remotePulse=1},
    attachTVDocument(el:HTMLElement|null){
      tvDocument.attach(el)
      if(el&&ready&&view.mode==='focus')tvDocument.place(canvas.clientWidth,canvas.clientHeight)
    },
    pause(value:boolean){blocked=value;reset()},elevate(){director.elevation();applyVisibility()},
    turnBottle(by:number){bottleAngle+=by},
    dispose(){
      disposed=true;cancelAnimationFrame(frame);observe.disconnect();listeners.forEach(([el,n,fn])=>el.removeEventListener(n,fn))
      tvDocument.attach(null);tv.dispose();coast.dispose();streetRain.dispose()
      free([...Object.values(scenes),bottleScene]);renderer.dispose();canvas.remove()
    },
  }
}
export type Game=ReturnType<typeof createStreetGame>
