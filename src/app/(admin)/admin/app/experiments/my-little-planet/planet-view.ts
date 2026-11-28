import * as T from 'three/webgpu'
import { BLOCK_HEIGHT, MAX_LAYER, MIN_LAYER, Category, Cell, RADIUS, WorldSave, cleanWorld, clamp, center, key, locate, readSave, variants } from './world'
import { cellLine, makeLandscape, makeSpecimens } from './landscape'
import { coastalMaterials } from './coastal-materials'
import { makeWalker } from './walking'
import { BlockTool, cellId, createTerrain, edgeUV, pointOn } from './terrain-blocks'

export type Selection={kind:Category;variant:number;edit:boolean;tool:BlockTool|null}
export type SceneHandle={
  choose:(s:Selection)=>void;zoom:(factor:number)=>void;home:()=>void;undo:()=>void;setGrid:(v:boolean)=>void;dispose:()=>void
  walk:(v:boolean)=>void;landAt:()=>void;moveStick:(x:number,z:number)=>void
}
export type SceneUI={note:(v:string)=>void;history:(n:number)=>void;ready:(count:number,backend:string)=>void;ground:(v:string)=>void;walking:(v:boolean)=>void}
const STORAGE='ooo.my-little-planet.environment.v1'
const startRotation=new T.Quaternion().setFromEuler(new T.Euler(.14,.04,-.12))
const cancelFrame=(n:number)=>{if(n)cancelAnimationFrame(n)}
function localWorld(){try{return readSave(localStorage.getItem(STORAGE))}catch{return cleanWorld()}}
export async function mountPlanet(canvas:HTMLCanvasElement,ui:SceneUI,signal:AbortSignal):Promise<SceneHandle|null>{
  const small=matchMedia('(max-width: 820px)').matches, reduced=small||matchMedia('(prefers-reduced-motion: reduce)').matches
  const renderer=new T.WebGPURenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})
  try{await renderer.init()}catch(error){renderer.dispose();throw error}
  if(signal.aborted){renderer.dispose();return null}
  renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,small?1.45:1.65))
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(33,1,.1,160),root=new T.Group();scene.add(root)
  root.quaternion.copy(startRotation)
  const fill=new T.HemisphereLight('#ffedcf','#b4c3b0',1.38),sun=new T.DirectionalLight('#ffe3b7',2.03)
  sun.position.set(-22,35,30);sun.castShadow=true
  Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:5,far:90})
  sun.shadow.mapSize.set(small?768:1536,small?768:1536);sun.shadow.normalBias=.042;sun.shadow.bias=-.00032
  const bounce=new T.DirectionalLight('#abd6de',.72);bounce.position.set(17,2,9);scene.add(fill,sun,bounce)
  const specs=makeSpecimens(),materials=coastalMaterials()
  let viewLevel:number|null=null,data=localWorld(),land=makeLandscape(specs,data,small,materials)
  root.add(land.group)
  let walker=makeWalker(land.terrain,land.obstacles),pickingLanding=false,orbitRotation=startRotation.clone()
  root.add(walker.group);scene.add(sun.target)
  const walkSky=new T.FogExp2('#d5dfcc',.021),litSide=new T.Vector3()
  function walkMode(on:boolean,normal?:T.Vector3){
    pickingLanding=false;clearOverlay();lastCell='';hovering=null;focus=null
    if(on){
      if(viewLevel!==null){viewLevel=null;refresh(false)}
      if(!walker.start(normal)){ui.note('没有找到足够大的干地，请先增加土地模块。');return}
      orbitRotation=root.quaternion.clone();root.quaternion.identity();land.setWalkFocus(walker.up)
      scene.fog=walkSky;camera.fov=51;sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9
      canvas.focus({preventScroll:true})
    }else{
      walker.stop();land.setWalkFocus(null);root.quaternion.copy(orbitRotation);camera.up.set(0,1,0);camera.fov=33;camera.position.set(0,0,homeZ*distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();scene.fog=null
      sun.position.set(-22,35,30);sun.target.position.set(0,0,0);fill.position.set(0,1,0);bounce.position.set(17,2,9)
      sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22
    }
    sun.shadow.camera.updateProjectionMatrix();camera.updateProjectionMatrix();canvas.dataset.walk=on?'true':'false'
    ui.walking(on);ui.ground('');dirty=true
  }
  let mode:Selection={kind:'tree',variant:0,edit:false,tool:null},grid=false,distance=1,targetDistance=1,frame=0,live=true
  let lastDraw=0, dirty=true, lastCell='', hovering:Cell|null=null, focus:T.Quaternion|null=null
  const history:WorldSave[]=[],ray=new T.Raycaster(),screen=new T.Vector2(),v3=new T.Vector3()
  const pointer=new Map<number,{x:number;y:number}>()
  let drag:{x:number;y:number;travel:number}|null=null,pinch=0
  const overlay=new T.Group();root.add(overlay)
  const hoverMat=new T.LineBasicMaterial({color:'#ffdf82',transparent:true,opacity:.98,depthWrite:false})
  const gridMat=new T.LineBasicMaterial({color:'#e6ecd2',transparent:true,opacity:.41,depthWrite:false})
  function clearOverlay(){for(const obj of [...overlay.children]){overlay.remove(obj);(obj as T.Line).geometry.dispose()}}
  function outline(c:Cell,material:T.LineBasicMaterial){
    const line=new T.Line(new T.BufferGeometry().setFromPoints(cellLine(c,land.terrain)),material);line.renderOrder=3;overlay.add(line)
  }
  const brushMat=new T.LineBasicMaterial({color:'#ffe4a1',transparent:true,opacity:.97,depthTest:false,depthWrite:false})
  function blockOutline(c:Cell,tool:BlockTool){
    const id=cellId(c),{layer,before}=land.terrain.target(id,tool)
    if(layer<MIN_LAYER||layer>MAX_LAYER)return
    const h=(layer+1)*BLOCK_HEIGHT,points:T.Vector3[]=[]
    for(let e=0;e<4;e++){
      const p0=pointOn(id,...edgeUV(e,0))
      points.push(p0.clone().multiplyScalar(RADIUS+h+.025),p0.clone().multiplyScalar(RADIUS+h-BLOCK_HEIGHT+.018))
      for(let j=0;j<4;j++)for(const alt of [h+.025,h-BLOCK_HEIGHT+.018]){
        points.push(pointOn(id,...edgeUV(e,j/4)).multiplyScalar(RADIUS+alt),pointOn(id,...edgeUV(e,(j+1)/4)).multiplyScalar(RADIUS+alt))
      }
    }
    const legal=tool.action==='add'?before===null:before!==null
    brushMat.color.set(!legal||tool.action==='dig'?'#f0a583':tool.material==='water'?'#b8ebe1':'#ffe7a0')
    const group=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),brushMat);group.renderOrder=5;overlay.add(group)
  }
  function displayCell(c:Cell|null){
    const id=c?key(c):''
    if(lastCell===id)return
    lastCell=id;hovering=c;clearOverlay()
    if(c&&(grid||mode.edit)){
      if(grid){
        const mid=center(c),near=new Map<string,Cell>()
        // Sample the local tangent plane, then resolve every cell back to its owning chart.
        const right=mid.clone().cross(Math.abs(mid.y)>.90?new T.Vector3(1,0,0):new T.Vector3(0,1,0)).normalize()
        const up=mid.clone().cross(right)
        for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
          const n=mid.clone().addScaledVector(right,i*.061).addScaledVector(up,j*.061).normalize(),a=locate(n);near.set(key(a),a)
        }
        near.forEach(a=>{if(key(a)!==id)outline(a,gridMat)})
      }
      if(mode.edit&&mode.tool)blockOutline(c,mode.tool);else outline(c,hoverMat)
    }
    dirty=true
  }
  function refresh(persist=true){
    root.remove(land.group,walker.group);walker.dispose();land.dispose();land=makeLandscape(specs,data,small,materials,viewLevel);root.add(land.group)
    walker=makeWalker(land.terrain,land.obstacles);root.add(walker.group)
    clearOverlay();lastCell='';hovering=null;dirty=true;ui.history(history.length)
    if(!persist)return true
    try{localStorage.setItem(STORAGE,JSON.stringify(data));return true}catch{return false}
  }
  function change(next:WorldSave,msg:string){
    history.push(data);if(history.length>40)history.shift()
    data=next;const saved=refresh();ui.note(saved?msg:msg+' · 本次更改仅在此页保留')
  }
  function place(n:T.Vector3){
    const c=locate(n)
    if(mode.tool){
      const changeTo=land.terrain.edit(cellId(c),mode.tool)
      if(!changeTo.world){ui.note(changeTo.reason??'无法修改这一格。');return}
      const verb={add:'已增加',dig:'已挖去',paint:'已替换'},name={grass:'草地',sand:'沙地',water:'海水'}
      const msg=verb[mode.tool.action]+(mode.tool.action==='dig'?'模块':name[mode.tool.material]+'模块')+' · 第 '+changeTo.layer+' 层'
      change(changeTo.world,msg);inspect(n);return
    }
    const s=land.terrain.sample(center(c)),k=mode.kind,v=mode.variant
    if(k==='creek'){
      const hit=land.terrain.sample(n)
      if(hit.route<0||hit.near>2.9){ui.note('请点在溪床或溪岸上，替换这条小溪的水道。');return}
      if(data.streams[hit.route]===v){ui.note('这条溪流已使用该形态。');return}
      const streams=data.streams.slice();streams[hit.route]=v
      const future=createTerrain({...data,streams})
      if(data.stamps.some(st=>st.kind!=='sand'&&future.sample(center(st)).wet)){ui.note('新河道会淹没已摆放的标本，请换一种形态。');return}
      change({...data,streams},'已替换溪流 · '+variants[k][v]);return
    }
    if(s.wet||!s.material){ui.note('这里是水面。请选择一块露出水面的地表。');return}
    if((k==='tree'||k==='grass')&&s.f<.10){ui.note('这里是潮间带。树和草需要更高的干地。');return}
    if(k==='sand'&&s.f>.32){ui.note('沙地笔刷适用于海岸和低台地。');return}
    const found=data.stamps.find(t=>key(t)===key(c))
    if(found&&found.kind!=='sand'){ui.note('这格已有你摆放的标本。请选相邻格或撤销。');return}
    if(found?.kind==='sand'&&k==='sand'&&found.variant===v){ui.note('这一格已铺设相同的沙地。');return}
    const stamps=data.stamps.filter(s=>key(s)!==key(c))
    stamps.push({...c,kind:k,variant:v,angle:((c.i*7+c.j*13+c.face)*.61)%(Math.PI*2)})
    change({...data,stamps},'已放置'+variants[k][v])
  }
  function targetAt(x:number,y:number){
    const b=canvas.getBoundingClientRect()
    screen.set((x-b.left)/b.width*2-1,1-(y-b.top)/b.height*2)
    root.updateMatrixWorld(true);camera.updateMatrixWorld();ray.setFromCamera(screen,camera)
    if(mode.edit&&mode.tool?.level!=null){
      const shell=new T.Sphere(new T.Vector3(),RADIUS+(mode.tool.level+1)*BLOCK_HEIGHT)
      const hit=ray.ray.intersectSphere(shell,new T.Vector3())
      return hit?root.worldToLocal(hit).normalize():null
    }
    const hit=ray.intersectObjects([land.surface,land.water],false)[0]
    return hit?root.worldToLocal(hit.point.clone()).normalize():null
  }
  function inspect(n:T.Vector3|null){
    displayCell(n?locate(n):null)
    if(!n){ui.ground('');return}
    const s=land.terrain.sample(n)
    if(mode.edit&&mode.tool){
      const hit=land.terrain.target(s.id,mode.tool),names={grass:'草地',sand:'沙地',water:'水'}
      ui.ground('第 '+hit.layer+' 层 · '+(hit.before?names[hit.before]:'空格'));return
    }
    ui.ground(s.river>=0?'溪床':s.wet?(s.depth>.7?'海水':'浅滩'):s.f<.10?'沙岸':s.f>.54?'高台草甸':'草地')
  }
  function zoom(factor:number){if(walker.active)walker.zoom(factor);else targetDistance=clamp(targetDistance*factor,.48,1.27);dirty=true}
  function orbit(dx:number,dy:number){
    if(walker.active){walker.look(dx,dy);dirty=true;return}
    focus=null;const sensitivity=.006*distance
    const rot=new T.Quaternion().setFromEuler(new T.Euler(dy*sensitivity,dx*sensitivity,0,'YXZ'))
    root.quaternion.premultiply(rot).normalize();dirty=true
  }
  function gap(){const a=[...pointer.values()];return a.length<2?0:Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y)}
  const opts={signal}
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointer.set(e.pointerId,{x:e.clientX,y:e.clientY})
    if(pointer.size===1)drag={x:e.clientX,y:e.clientY,travel:0}
    else{pinch=gap();if(drag)drag.travel=100}
  },opts)
  canvas.addEventListener('pointermove',e=>{
    const old=pointer.get(e.pointerId)
    if(old){
      pointer.set(e.pointerId,{x:e.clientX,y:e.clientY})
      if(pointer.size===2){const g=gap();if(pinch>0&&g>0)zoom(pinch/g);pinch=g;return}
      const dx=e.clientX-old.x,dy=e.clientY-old.y
      if(drag){drag.travel+=Math.hypot(dx,dy);if(drag.travel>4){orbit(dx,dy);displayCell(null)}}
    }else if(!walker.active&&(mode.edit||grid||pickingLanding))inspect(targetAt(e.clientX,e.clientY))
  },opts)
  canvas.addEventListener('pointerup',e=>{
    const tap=pointer.has(e.pointerId)&&pointer.size===1&&!!drag&&drag.travel<=5
    pointer.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)
    if(tap&&!walker.active){const n=targetAt(e.clientX,e.clientY);inspect(n)
      if(n&&pickingLanding){if(land.terrain.sample(n).wet)ui.note('请在露出水面的地表选择落点。');else {walkMode(true,n);ui.note('已抵达新的落点。')}}
      else if(n&&mode.edit)place(n)}
    if(!pointer.size)drag=null
  },opts)
  canvas.addEventListener('pointercancel',e=>{pointer.delete(e.pointerId);drag=null;pinch=0},opts)
  canvas.addEventListener('pointerleave',()=>{if(!pointer.size){displayCell(null);ui.ground('')}},opts)
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(clamp(e.deltaY,-95,95)*.0019))},{passive:false,signal})
  canvas.addEventListener('dblclick',e=>{
    if(mode.edit||walker.active||pickingLanding)return
    const n=targetAt(e.clientX,e.clientY);if(!n)return
    const view=n.applyQuaternion(root.quaternion),q=new T.Quaternion().setFromUnitVectors(view,new T.Vector3(0,0,1))
    focus=q.multiply(root.quaternion.clone());targetDistance=.56;dirty=true
  },opts)
  canvas.addEventListener('keydown',e=>{
    if(walker.active)return
    const dir:Record<string,[number,number]>={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}
    if(dir[e.key]){e.preventDefault();orbit(...dir[e.key])}
    if(e.key==='+'||e.key==='=')zoom(.85);if(e.key==='-')zoom(1.17)
  },opts)
  window.addEventListener('keydown',e=>{
    if(!walker.active||e.ctrlKey||e.metaKey||e.altKey)return
    if((e.target as HTMLElement)?.matches('input,textarea,select,[contenteditable=true]'))return
    if(walker.key(e.code,true))e.preventDefault()
    if(e.code==='Escape'){walkMode(false);e.preventDefault()}
  },opts)
  window.addEventListener('keyup',e=>{if(walker.key(e.code,false))e.preventDefault()},opts)
  window.addEventListener('blur',()=>walker.clear(),opts)
  document.addEventListener('visibilitychange',()=>{if(document.hidden)walker.clear()},opts)
  let homeZ=63
  function resize(){
    const b=canvas.getBoundingClientRect();if(!b.width||!b.height)return
    renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix()
    homeZ=18.25/Math.sin(T.MathUtils.degToRad(16.5))/Math.min(1,camera.aspect);dirty=true
  }
  const ro=new ResizeObserver(resize);ro.observe(canvas);resize()
  let shown=false,previousTime=0
  function tick(t:number){
    if(!live)return
    frame=requestAnimationFrame(tick)
    if(document.hidden)return
    if(Math.abs(targetDistance-distance)>.0002){distance+=(targetDistance-distance)*.2;dirty=true}
    if(focus){root.quaternion.slerp(focus,.17);if(root.quaternion.angleTo(focus)<.002){root.quaternion.copy(focus);focus=null}dirty=true}
    if(!dirty&&t-lastDraw<(walker.active?(small?31:16):(reduced?95:35)))return
    const dt=clamp(previousTime?(t-previousTime)/1000:1/30,.001,.10);previousTime=t
    const near=walker.active||distance<.85?'true':'false';if(canvas.dataset.near!==near)canvas.dataset.near=near
    if(walker.active){
      walker.tick(dt,camera);land.setWalkFocus(walker.up)
      sun.target.position.copy(walker.group.position);litSide.copy(walker.right)
      sun.position.copy(sun.target.position).addScaledVector(walker.up,24).addScaledVector(litSide,-15).addScaledVector(walker.forward,-8)
      fill.position.copy(walker.up);bounce.position.copy(walker.group.position).addScaledVector(walker.right,14).addScaledVector(walker.up,10)
      const pos=walker.up;canvas.dataset.walkPosition=pos.toArray().map(n=>n.toFixed(5)).join(',')
    }else{camera.position.set(0,0,homeZ*distance);camera.lookAt(v3.set(0,0,0))}
    renderer.render(scene,camera);dirty=false;lastDraw=t
    if(!shown){shown=true;canvas.dataset.ready='true';ui.ready(land.count,renderer.backend.constructor.name.includes('WebGL')?'WebGL 2':'WebGPU')}
  }
  frame=requestAnimationFrame(tick)
  return {
    choose(s){mode=s
      if(s.edit)pickingLanding=false
      const limit=!walker.active&&s.edit&&s.tool?s.tool.level:null
      if(limit!==viewLevel){viewLevel=limit;refresh(false)}
      lastCell='!';displayCell(hovering)
      if(!s.edit)ui.ground('')
    },zoom,
    walk(v){walkMode(v)},landAt(){if(walker.active)walkMode(false);pickingLanding=true;ui.note('旋转星球，在想去的干地上轻点落地。')},moveStick(x,z){walker.touch(x,z)},
    home(){focus=startRotation.clone();targetDistance=1;dirty=true},
    undo(){const previous=history.pop();if(previous){data=previous;const saved=refresh();ui.note(saved?'已撤销上一步。':'已撤销 · 本次更改仅在此页保留')}},
    setGrid(v){grid=v;lastCell='!';displayCell(hovering)},
    dispose(){live=false;cancelFrame(frame);ro.disconnect();clearOverlay();hoverMat.dispose();gridMat.dispose();brushMat.dispose();walker.dispose();land.dispose();materials.dispose();specs.forEach(g=>g.dispose());sun.shadow.dispose();renderer.dispose()}
  }
}
