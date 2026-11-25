import * as T from 'three/webgpu'
import { coastalMaterials, seaWind } from './coastal-materials'
import { Category, CELLS, RADIUS, WorldSave, center, clamp, facePoint, hash, key, locate, makeCreeks, noise, random, sample, smooth, UP } from './world'
import { specimen } from './specimens'

const color=(c:string)=>new T.Color(c)
const palette={deep:color('#337f83'),blue:color('#529e98'),lagoon:color('#83c2ae'),surf:color('#bad8be'),foam:color('#f1e9ce'),
  dry:color('#e3c992'),wet:color('#bdaa82'),lawn:color('#97a45f'),moss:color('#738348'),ridge:color('#9a9271'),soil:color('#a38c66'),creek:color('#6cafa3')}
type Creeks=ReturnType<typeof makeCreeks>
type Prop={kind:'tree'|'rock'|'grass';v:number;p:T.Vector3;size:number;yaw:number;cell:string}
export type Specimens = ReturnType<typeof makeSpecimens>
export function makeSpecimens(){
  const kinds:Category[]=['tree','rock','grass','sand','creek']
  const out=new Map<string,T.BufferGeometry>()
  for(const k of kinds)for(let i=0;i<3;i++)out.set(k+i,specimen(k,i))
  return out
}
function landGeometry(w:WorldSave,creeks:Creeks,res:number){
  const pos:number[]=[],col:number[]=[],covers:number[]=[],depths:number[]=[],rivers:number[]=[],currents:number[]=[],waterPos:number[]=[],ind:number[]=[],wi:number[]=[]
  const sand=w.stamps.filter(s=>s.kind==='sand').map(s=>({p:center(s),v:s.variant}))
  const shades=[color('#e0c68d'),color('#dcc9a8'),color('#cfb382')]
  for(let f=0;f<6;f++){
    const start=pos.length/3
    for(let j=0;j<=res;j++)for(let i=0;i<=res;i++){
      const p=facePoint(f,i/res,j/res),{bed,wet,waterPlane,depth,river,route,f:field,near}=sample(p,creeks)
      const n=noise(p.x*19+7,p.y*19,p.z*19), mott=noise(p.x*55,p.y*55+3,p.z*55)
      let shade:T.Color,cover=0
      if(wet){
        const stone=river>=0&&waterPlane>.04
        shade=color(stone?'#809b88':'#d8c596').lerp(color(stone?'#8c9380':'#bbad86'),n*.56)
        shade.multiplyScalar(.91+.13*mott)
      }else{
        const meadow=smooth(.118,.205,field+(n-.5)*.065),bank=1-smooth(.75,1.75,near)
        cover=meadow
        shade=palette.wet.clone().lerp(palette.dry,smooth(.01,.31,bed))
        shade.lerp(palette.lawn.clone().lerp(palette.moss,clamp(.19+.88*n+(mott-.5)*.23)),meadow)
        const band=Math.max(...[[.15,.205],[.335,.385],[.54,.61]].map(([a,b])=>smooth(a,a+.011,field)*(1-smooth(b-.013,b,field))))
        shade.lerp(palette.soil.clone().lerp(palette.ridge,n),band*.88)
        shade.lerp(palette.ridge,bank*.54)
        for(const paint of sand){
          const d=p.distanceToSquared(paint.p)
          if(d<.0072){const strength=1-smooth(.0018,.0072,d)
            const detail=paint.v===2?Math.sin((p.x*1.1+p.y*.6+p.z*.35)*720)*.07:paint.v===1?(mott-.45)*.23:0
            cover*=1-strength
            shade.lerp(shades[paint.v].clone().multiplyScalar(1+detail),strength)}
        }
        shade.multiplyScalar(.90+.15*n+.055*mott)
      }
      const h=bed+(mott-.5)*(wet?.045:.053)
      const q=p.clone().multiplyScalar(RADIUS+h),surf=p.clone().multiplyScalar(RADIUS+waterPlane)
      pos.push(q.x,q.y,q.z);waterPos.push(surf.x,surf.y,surf.z);col.push(shade.r,shade.g,shade.b)
      covers.push(cover);depths.push(waterPlane-h);rivers.push(route>=0&&near<2.1?1:0)
      const flow=route>=0&&near<2.1?creeks[route].along:seaWind
      currents.push(flow.x,flow.y,flow.z)
      if(i<res&&j<res){const a=start+j*(res+1)+i,b=a+1,c=a+res+1,d=c+1;ind.push(a,b,d,a,d,c)}
    }
  }
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3))
  g.setAttribute('grassCover',new T.Float32BufferAttribute(covers,1));g.setAttribute('waterDepth',new T.Float32BufferAttribute(depths,1));g.setIndex(ind);g.computeVertexNormals()
  // Weld shading directions where two chart borders represent the same place.
  const ns=g.getAttribute('normal'),edges=new Map<string,{sum:T.Vector3;ids:number[]}>()
  for(let f=0;f<6;f++)for(let j=0;j<=res;j++)for(let i=0;i<=res;i++){
    if(i&&j&&i!==res&&j!==res)continue
    const id=f*(res+1)**2+j*(res+1)+i, k=[0,1,2].map(a=>Math.round(pos[3*id+a]*10000)).join(',')
    let e=edges.get(k);if(!e){e={sum:new T.Vector3(),ids:[]};edges.set(k,e)}e.sum.add(new T.Vector3().fromBufferAttribute(ns,id));e.ids.push(id)
  }
  for(const {sum,ids} of edges.values()){sum.normalize();for(const id of ids)ns.setXYZ(id,sum.x,sum.y,sum.z)}
  for(let i=0;i<ind.length;i+=3){
    const a=ind[i],b=ind[i+1],c=ind[i+2]
    if(Math.max(depths[a],depths[b],depths[c])>-.02)wi.push(a,b,c)
  }
  const water=new T.BufferGeometry()
  water.setAttribute('position',new T.Float32BufferAttribute(waterPos,3))
  water.setAttribute('waterDepth',new T.Float32BufferAttribute(depths,1))
  water.setAttribute('currentDirection',new T.Float32BufferAttribute(currents,3))
  water.setAttribute('riverWeight',new T.Float32BufferAttribute(rivers,1))
  water.setIndex(wi);water.computeVertexNormals();water.computeBoundingSphere();g.computeBoundingSphere()
  return {ground:g,water}
}
function distribution(w:WorldSave,creeks:Creeks){
  const r=random(29851),props:Prop[]=[],occupied=new Set<string>(),overrides=new Set(w.stamps.map(key))
  const treeLocations:T.Vector3[]=[]
  const n=4200,gold=Math.PI*(3-Math.sqrt(5))
  for(let i=0;i<n;i++){
    const y=1-2*(i+.5)/n,a=i*gold+(r()-.5)*.019,l=Math.sqrt(1-y*y)
    const p=new T.Vector3(Math.sin(a)*l,y,Math.cos(a)*l),c=key(locate(p)),s=sample(p,creeks)
    const luck=r(),type=r(),scale=r(),yaw=r()*Math.PI*2,detail=r()
    if(overrides.has(c)||s.bed<-1.05||(s.near<.82&&!s.wet))continue
    const grove=noise(p.x*5+17,p.y*5+1,p.z*5),grass=s.f>.13
    let k:Prop['kind']|null=null,v=0,size=1
    if(grass&&s.near>2.25&&grove>.44&&luck<.16*(grove*1.4)&&treeLocations.every(q=>q.distanceToSquared(p)>.012)){
      k='tree';v=grove>.65?(type>.45?0:2):(type>.43?1:0);size=.61+.29*scale;treeLocations.push(p)
    }else if(luck<(s.near<2.3?.66:s.wet?.19:grass?.047:.12)){
      k='rock';v=s.near<2.6||s.wet?2:type<.43?0:type<.77?1:2;size=s.wet?.20+.55*scale:.40+.75*scale
    }else if(grass&&luck<.66&&grove>.32&&!s.wet){
      k='grass';v=s.near<2.6?2:type<.64?0:type<.84?1:2;size=.68+.67*scale
    }
    if(k){props.push({kind:k,v,p,size,yaw,cell:c});if(k!=='grass')occupied.add(c)
      if(k==='grass'&&detail>.52){
        const east=p.clone().cross(Math.abs(y)>.91?new T.Vector3(1,0,0):UP).normalize()
        const pp=p.clone().addScaledVector(east,.028).normalize()
        if(!overrides.has(key(locate(pp)))&&!sample(pp,creeks).wet)props.push({kind:k,v,p:pp,size:size*.73,yaw:yaw+1,cell:key(locate(pp))})
      }
    }
  }
  for(const s of w.stamps)if(s.kind!=='sand'){
    const p=center(s),q=sample(p,creeks);if(q.wet)continue
    props.push({kind:s.kind,v:s.variant,p,size:1,yaw:s.angle,cell:key(s)})
  }
  return props
}
export function makeLandscape(specs:Specimens,w:WorldSave,reduced:boolean){
  const group=new T.Group(),creeks=makeCreeks(w.streams)
  const mats=coastalMaterials(),geo=landGeometry(w,creeks,reduced?96:128)
  const surface=new T.Mesh(geo.ground,mats.ground),water=new T.Mesh(geo.water,mats.sea)
  surface.receiveShadow=true;water.renderOrder=2;group.add(surface,water)
  const props=distribution(w,creeks),batches=new Map<string,Prop[]>()
  const mat=new T.Matrix4(),q=new T.Quaternion(),spin=new T.Quaternion(),scale=new T.Vector3()
  for(const prop of props){const id=prop.kind+prop.v;let bucket=batches.get(id);if(!bucket){bucket=[];batches.set(id,bucket)}bucket.push(prop)}
  const entries=Array.from(batches,([id,items])=>{
    const material=id.startsWith('rock')?mats.rock:mats.plant
    const mesh=new T.InstancedMesh(specs.get(id)!,material,items.length),matrices:T.Matrix4[]=[],tints:T.Color[]=[]
    items.forEach((s,i)=>{
      q.setFromUnitVectors(UP,s.p).multiply(spin.setFromAxisAngle(UP,s.yaw));scale.setScalar(s.size)
      const ground=sample(s.p,creeks),h=ground.bed
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
        const scale=.32+.42*rng(),yaw=rng()*6.283,s=sample(p,creeks)
        if(s.wet||s.f<.172||s.near<1.13||editedCells.has(key(locate(p))))continue
        allTurf.push({p:p.multiplyScalar(RADIUS+s.bed-.015),scale,yaw})
      }
      turf=new T.InstancedMesh(specs.get(turfKey)!,mats.plant,allTurf.length)
      turf.receiveShadow=true;turf.frustumCulled=false;group.add(turf)
    }
    const at=focus.clone().multiplyScalar(RADIUS+sample(focus,creeks).bed),up=new T.Vector3()
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
  return {group,surface,water,creeks,obstacles,setWalkFocus,count:props.length,dispose(){
    geo.ground.dispose();geo.water.dispose();mats.dispose();turf?.dispose();entries.forEach(e=>{e.mesh.dispose();e.close?.dispose()})
  }}
}
export function cellLine(c:{face:number;i:number;j:number},creeks:Creeks){
  const points:T.Vector3[]=[]
  const verts=[[0,0],[1,0],[1,1],[0,1],[0,0]]
  for(let k=0;k<4;k++)for(let step=0;step<=6;step++){
    const t=step/6,u=c.i+verts[k][0]*(1-t)+verts[k+1][0]*t,v=c.j+verts[k][1]*(1-t)+verts[k+1][1]*t
    const p=facePoint(c.face,u/CELLS,v/CELLS);points.push(p.multiplyScalar(RADIUS+sample(p,creeks).height+.062))
  }
  return points
}
