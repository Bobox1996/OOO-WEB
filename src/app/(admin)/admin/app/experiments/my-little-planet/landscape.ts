import * as T from 'three/webgpu'
import { coastalMaterials } from './coastal-materials'
import { Category, CELLS, MAX_LAYER, RADIUS, WorldSave, center, clamp, facePoint, key, locate, noise, random, smooth, UP } from './world'
import { createTerrain, Terrain } from './terrain-blocks'
import { blockGeometry } from './block-mesh'
import { specimen } from './specimens'

type Prop={kind:'tree'|'rock'|'grass';v:number;p:T.Vector3;size:number;yaw:number;cell:string}
export type Specimens = ReturnType<typeof makeSpecimens>
export function makeSpecimens(){
  const kinds:Category[]=['tree','rock','grass','sand','creek']
  const out=new Map<string,T.BufferGeometry>()
  for(const k of kinds)for(let i=0;i<3;i++)out.set(k+i,specimen(k,i))
  return out
}
function distribution(w:WorldSave,terrain:Terrain){
  const r=random(29851),props:Prop[]=[],overrides=new Set(w.stamps.map(key))
  const treeLocations:T.Vector3[]=[]
  const n=4200,gold=Math.PI*(3-Math.sqrt(5))
  for(let i=0;i<n;i++){
    const y=1-2*(i+.5)/n,a=i*gold+(r()-.5)*.019,l=Math.sqrt(1-y*y)
    const p=new T.Vector3(Math.sin(a)*l,y,Math.cos(a)*l),c=key(locate(p)),s=terrain.sample(p)
    const luck=r(),type=r(),scale=r(),yaw=r()*Math.PI*2,detail=r()
    if(!s.material||overrides.has(c)||s.bed<-1.05||(s.near<.82&&!s.wet))continue
    const grove=noise(p.x*5+17,p.y*5+1,p.z*5),grass=s.f>.13
    let k:Prop['kind']|null=null,v=0,size=1
    if(grass&&s.near>2.25&&grove>.44&&luck<.16*(grove*1.4)&&treeLocations.every(q=>q.distanceToSquared(p)>.012)){
      k='tree';v=grove>.65?(type>.45?0:2):(type>.43?1:0);size=.61+.29*scale;treeLocations.push(p)
    }else if(luck<(s.near<2.3?.66:s.wet?.19:grass?.047:.12)){
      k='rock';v=s.near<2.6||s.wet?2:type<.43?0:type<.77?1:2;size=s.wet?.20+.55*scale:.40+.75*scale
    }else if(grass&&luck<.66&&grove>.32&&!s.wet){
      k='grass';v=s.near<2.6?2:type<.64?0:type<.84?1:2;size=.68+.67*scale
    }
    if(k){props.push({kind:k,v,p,size,yaw,cell:c});
      if(k==='grass'&&detail>.52){
        const east=p.clone().cross(Math.abs(y)>.91?new T.Vector3(1,0,0):UP).normalize()
        const pp=p.clone().addScaledVector(east,.028).normalize()
        if(!overrides.has(key(locate(pp)))&&!terrain.sample(pp).wet)props.push({kind:k,v,p:pp,size:size*.73,yaw:yaw+1,cell:key(locate(pp))})
      }
    }
  }
  for(const s of w.stamps)if(s.kind!=='sand'){
    const p=center(s),q=terrain.sample(p);if(q.submerged||!q.material)continue
    props.push({kind:s.kind,v:s.variant,p,size:1,yaw:s.angle,cell:key(s)})
  }
  return props
}
export function makeLandscape(specs:Specimens,w:WorldSave,reduced:boolean,mats:ReturnType<typeof coastalMaterials>,limit:number|null=null){
  const group=new T.Group(),terrain=createTerrain(w,limit??MAX_LAYER),creeks=terrain.creeks
  const geo=blockGeometry(terrain,reduced)
  const surface=new T.Mesh(geo.ground,mats.ground),water=new T.Mesh(geo.water,mats.sea)
  surface.receiveShadow=true;water.renderOrder=2;group.add(surface,water)
  const props=limit===null?distribution(w,terrain):[],batches=new Map<string,Prop[]>()
  const mat=new T.Matrix4(),q=new T.Quaternion(),spin=new T.Quaternion(),scale=new T.Vector3()
  for(const prop of props){const id=prop.kind+prop.v;let bucket=batches.get(id);if(!bucket){bucket=[];batches.set(id,bucket)}bucket.push(prop)}
  const entries=Array.from(batches,([id,items])=>{
    const material=id.startsWith('rock')?mats.rock:mats.plant
    const mesh=new T.InstancedMesh(specs.get(id)!,material,items.length),matrices:T.Matrix4[]=[],tints:T.Color[]=[]
    items.forEach((s,i)=>{
      q.setFromUnitVectors(UP,s.p).multiply(spin.setFromAxisAngle(UP,s.yaw));scale.setScalar(s.size)
      const ground=terrain.sample(s.p),h=ground.bed
      if(s.kind==='rock'){
        const wet=ground.wet?clamp(.32+ground.depth*1.9):0
        const color=new T.Color(1,1,1).lerp(new T.Color(.51,.68,.66),wet)
        mesh.setColorAt(i,color);tints.push(color)
      }
      mat.compose(s.p.clone().multiplyScalar(RADIUS+h-(s.kind==='rock'?.035:.018)),q,scale);mesh.setMatrixAt(i,mat);matrices.push(mat.clone())
    })
    mesh.castShadow=!id.startsWith('grass');mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh)
    return {id,items,matrices,tints,mesh,close:null as T.InstancedMesh|null}
  })
  const turfKey='local-sward'
  let turf:T.InstancedMesh|null=null
  const editedCells=new Set(w.stamps.map(key))
  const allTurf:{p:T.Vector3;scale:number;yaw:number}[]=[]
  function updateGroundCover(focus:T.Vector3|null){
    if(!focus){if(turf)turf.count=0;return}
    if(!turf){
      if(!specs.has(turfKey))specs.set(turfKey,specimen('grass',0))
      const rng=random(4759),total=16400,gold=Math.PI*(3-Math.sqrt(5))
      for(let i=0;i<total;i++){
        const y=1-2*(i+.5)/total,a=i*gold+(rng()-.5)*.025,l=Math.sqrt(1-y*y)
        const p=new T.Vector3(Math.sin(a)*l,y,Math.cos(a)*l)
        const scale=.32+.42*rng(),yaw=rng()*6.283,s=terrain.sample(p)
        if(s.wet||s.f<.172||s.near<1.13||editedCells.has(key(locate(p))))continue
        allTurf.push({p:p.multiplyScalar(RADIUS+s.bed-.015),scale,yaw})
      }
      turf=new T.InstancedMesh(specs.get(turfKey)!,mats.plant,allTurf.length)
      turf.receiveShadow=true;turf.frustumCulled=false;group.add(turf)
    }
    const at=focus.clone().multiplyScalar(RADIUS+terrain.sample(focus).bed),up=new T.Vector3()
    let count=0
    for(const s of allTurf){
      const d=s.p.distanceToSquared(at)
      if(d>36)continue
      q.setFromUnitVectors(UP,up.copy(s.p).normalize()).multiply(spin.setFromAxisAngle(UP,s.yaw))
      scale.setScalar(s.scale*(1-smooth(25,36,d)))
      mat.compose(s.p,q,scale);turf.setMatrixAt(count++,mat)
    }
    turf.count=count;turf.instanceMatrix.needsUpdate=true
  }
  let lastFocus:T.Vector3|null=null
  function setWalkFocus(focus:T.Vector3|null){
    if(!focus&&!lastFocus)return
    if(focus&&lastFocus&&lastFocus.distanceToSquared(focus)<.0012)return
    lastFocus=focus?.clone()??null;updateGroundCover(focus)
    for(const e of entries){
      if(!focus){e.matrices.forEach((m,i)=>{e.mesh.setMatrixAt(i,m);if(e.tints[i])e.mesh.setColorAt(i,e.tints[i])});if(e.mesh.instanceColor)e.mesh.instanceColor.needsUpdate=true;e.mesh.count=e.items.length;e.mesh.instanceMatrix.needsUpdate=true;if(e.close)e.close.count=0;continue}
      if(!e.close){
        const prop=e.items[0],k=e.id+'-close';if(!specs.has(k))specs.set(k,specimen(prop.kind,prop.v,true))
        e.close=new T.InstancedMesh(specs.get(k)!,e.mesh.material,e.items.length)
        e.close.castShadow=e.mesh.castShadow;e.close.receiveShadow=true;e.close.frustumCulled=false;group.add(e.close)
      }
      let near=0,far=0
      const maxSq=(e.id.startsWith('tree')?7.2:e.id.startsWith('rock')?5.5:4.7)**2/(RADIUS*RADIUS)
      for(let i=0;i<e.items.length;i++){
        const isClose=e.items[i].p.distanceToSquared(focus)<maxSq,mesh=isClose?e.close:e.mesh,index=isClose?near++:far++
        mesh.setMatrixAt(index,e.matrices[i]);if(e.tints[i])mesh.setColorAt(index,e.tints[i])
      }
      if(e.mesh.instanceColor)e.mesh.instanceColor.needsUpdate=true;if(e.close.instanceColor)e.close.instanceColor.needsUpdate=true
      e.mesh.count=far;e.close.count=near;e.mesh.instanceMatrix.needsUpdate=true;e.close.instanceMatrix.needsUpdate=true
    }
  }
  const obstacles=props.filter(s=>s.kind==='tree').map(s=>({p:s.p,radius:.13+s.size*.15}))
  return {group,surface,water,creeks,terrain,obstacles,setWalkFocus,count:props.length,dispose(){
    geo.ground.dispose();geo.water.dispose();turf?.dispose();entries.forEach(e=>{e.mesh.dispose();e.close?.dispose()})
  }}
}
export function cellLine(c:{face:number;i:number;j:number},terrain:Terrain){
  const points:T.Vector3[]=[]
  const verts=[[0,0],[1,0],[1,1],[0,1],[0,0]]
  for(let k=0;k<4;k++)for(let step=0;step<=6;step++){
    const t=step/6,u=c.i+verts[k][0]*(1-t)+verts[k+1][0]*t,v=c.j+verts[k][1]*(1-t)+verts[k+1][1]*t
    const p=facePoint(c.face,u/CELLS,v/CELLS);points.push(p.multiplyScalar(RADIUS+terrain.sample(p).height+.062))
  }
  return points
}
