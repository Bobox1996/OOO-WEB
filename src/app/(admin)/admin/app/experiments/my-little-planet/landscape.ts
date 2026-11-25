import * as T from 'three/webgpu'
import { attribute, float, mix, positionLocal, sin, texture, time, vec2, vec3 } from 'three/tsl'
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
function grain(){
  const p=new Uint8Array(128*128*4),r=random(618)
  for(let i=0;i<p.length;i+=4){const c=Math.floor(255*(.28+.7*r()));p[i]=p[i+1]=p[i+2]=c;p[i+3]=255}
  const m=new T.DataTexture(p,128,128,T.RGBAFormat)
  m.wrapS=m.wrapT=T.RepeatWrapping;m.magFilter=T.LinearFilter;m.minFilter=T.LinearMipmapLinearFilter;m.generateMipmaps=true;m.needsUpdate=true;return m
}
function flowMap(){
  const pixels=new Uint8Array(128*128*4),r=random(7201)
  const harmonics=Array.from({length:11},(_,i)=>({x:1+Math.floor(r()*4),y:Math.floor(r()*5)-2,phase:r()*6.28,w:1/(i+2)}))
  for(let j=0;j<128;j++)for(let i=0;i<128;i++){
    const sum=harmonics.reduce((n,h)=>n+Math.sin((i*h.x+j*h.y)*Math.PI/64+h.phase)*h.w,0)
    const k=4*(j*128+i);pixels[k]=Math.round(255*clamp(.5+sum*.26));pixels[k+1]=pixels[k+2]=pixels[k];pixels[k+3]=255
  }
  const m=new T.DataTexture(pixels,128,128,T.RGBAFormat);m.wrapS=m.wrapT=T.RepeatWrapping
  m.magFilter=T.LinearFilter;m.minFilter=T.LinearMipmapLinearFilter;m.generateMipmaps=true;m.needsUpdate=true;return m
}
function surfaceMaterial(gr:T.DataTexture,flow:T.DataTexture){
  const m=new T.MeshStandardNodeMaterial({roughness:.86,metalness:0})
  const wet=attribute<'float'>('wetness','float'),col=attribute<'vec3'>('color','vec3')
  const uv=vec2(positionLocal.x.add(positionLocal.z.mul(.39)),positionLocal.y.add(positionLocal.z.mul(.71)))
  const grainValue=texture(gr,uv.mul(.68)).r
  const swell=texture(flow,uv.mul(.12).add(vec2(time.mul(.004),time.mul(-.003)))).r
  const detail=texture(flow,uv.mul(vec2(.19,.64)).add(vec2(time.mul(-.008),time.mul(.005)))).r
  const phaseA=uv.y.mul(6.8).add(uv.x.mul(1.9)).add(time.mul(.6)).add(swell.mul(12)).add(detail.mul(2))
  const ripple=sin(phaseA).mul(.37).add(detail.mul(.48)).add(.31)
  const spark=ripple.smoothstep(.72,.98).mul(detail.smoothstep(.47,.83)).mul(.035)
  const land=col.mul(grainValue.mul(.19).add(.89))
  const water=col.mul(ripple.mul(.055).add(.94)).mul(swell.mul(.14).add(.93)).add(vec3(.55,.69,.62).mul(spark))
  m.colorNode=mix(land,water,wet)
  m.roughnessNode=mix(float(.9),float(.35),wet)
  return m
}
function landGeometry(w:WorldSave,creeks:Creeks,res:number){
  const pos:number[]=[],col:number[]=[],wetness:number[]=[],ind:number[]=[]
  const sand=w.stamps.filter(s=>s.kind==='sand').map(s=>({p:center(s),v:s.variant}))
  const shades=[color('#e0c68d'),color('#dcc9a8'),color('#cfb382')]
  for(let f=0;f<6;f++){
    const start=pos.length/3
    for(let j=0;j<=res;j++)for(let i=0;i<=res;i++){
      const p=facePoint(f,i/res,j/res),{bed,wet,height,depth,river,f:field,near}=sample(p,creeks)
      const n=noise(p.x*19+7,p.y*19,p.z*19), mott=noise(p.x*55,p.y*55+3,p.z*55)
      const ww=wet?smooth(0,.045,depth):0
      let shade:T.Color
      if(wet){
        if(river>=0&&height>.015)shade=palette.creek.clone().lerp(palette.surf,.25+.47*(1-smooth(0,.14,depth)))
        else shade=palette.surf.clone().lerp(palette.lagoon,smooth(.01,.38,depth)).lerp(palette.blue,smooth(.3,1.45,depth)).lerp(palette.deep,smooth(1.2,2.7,depth))
        const foam=(1-smooth(.015,.16,depth))*(.15+.61*n)
        shade.lerp(palette.foam,foam)
      }else{
        const meadow=smooth(.118,.205,field+(n-.5)*.065),bank=1-smooth(.75,1.75,near)
        shade=palette.wet.clone().lerp(palette.dry,smooth(.01,.31,bed))
        shade.lerp(palette.lawn.clone().lerp(palette.moss,clamp(.19+.88*n+(mott-.5)*.23)),meadow)
        const band=Math.max(...[[.15,.205],[.335,.385],[.54,.61]].map(([a,b])=>smooth(a,a+.011,field)*(1-smooth(b-.013,b,field))))
        shade.lerp(palette.soil.clone().lerp(palette.ridge,n),band*.88)
        shade.lerp(palette.ridge,bank*.54)
        for(const paint of sand){
          const d=p.distanceToSquared(paint.p)
          if(d<.0072){const strength=1-smooth(.0018,.0072,d)
            const detail=paint.v===2?Math.sin((p.x*1.1+p.y*.6+p.z*.35)*720)*.07:paint.v===1?(mott-.45)*.23:0
            shade.lerp(shades[paint.v].clone().multiplyScalar(1+detail),strength)}
        }
        shade.multiplyScalar(.90+.15*n+.055*mott)
      }
      const h=height+(wet?0:(mott-.5)*.053)
      const q=p.clone().multiplyScalar(RADIUS+h);pos.push(q.x,q.y,q.z);col.push(shade.r,shade.g,shade.b);wetness.push(ww)
      if(i<res&&j<res){const a=start+j*(res+1)+i,b=a+1,c=a+res+1,d=c+1;ind.push(a,b,d,a,d,c)}
    }
  }
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3))
  g.setAttribute('wetness',new T.Float32BufferAttribute(wetness,1));g.setIndex(ind);g.computeVertexNormals()
  // Weld shading directions where two chart borders represent the same place.
  const ns=g.getAttribute('normal'),edges=new Map<string,{sum:T.Vector3;ids:number[]}>()
  for(let f=0;f<6;f++)for(let j=0;j<=res;j++)for(let i=0;i<=res;i++){
    if(i&&j&&i!==res&&j!==res)continue
    const id=f*(res+1)**2+j*(res+1)+i, k=[0,1,2].map(a=>Math.round(pos[3*id+a]*10000)).join(',')
    let e=edges.get(k);if(!e){e={sum:new T.Vector3(),ids:[]};edges.set(k,e)}e.sum.add(new T.Vector3().fromBufferAttribute(ns,id));e.ids.push(id)
  }
  for(const {sum,ids} of edges.values()){sum.normalize();for(const id of ids)ns.setXYZ(id,sum.x,sum.y,sum.z)}
  g.computeBoundingSphere();return g
}
function distribution(w:WorldSave,creeks:Creeks){
  const r=random(29851),props:Prop[]=[],occupied=new Set<string>(),overrides=new Set(w.stamps.map(key))
  const treeLocations:T.Vector3[]=[]
  const n=4200,gold=Math.PI*(3-Math.sqrt(5))
  for(let i=0;i<n;i++){
    const y=1-2*(i+.5)/n,a=i*gold+(r()-.5)*.019,l=Math.sqrt(1-y*y)
    const p=new T.Vector3(Math.sin(a)*l,y,Math.cos(a)*l),c=key(locate(p)),s=sample(p,creeks)
    const luck=r(),type=r(),scale=r(),yaw=r()*Math.PI*2,detail=r()
    if(overrides.has(c)||s.bed<-.24||s.near<.82)continue
    const grove=noise(p.x*5+17,p.y*5+1,p.z*5),grass=s.f>.13
    let k:Prop['kind']|null=null,v=0,size=1
    if(grass&&s.near>2.25&&grove>.44&&luck<.16*(grove*1.4)&&treeLocations.every(q=>q.distanceToSquared(p)>.012)){
      k='tree';v=grove>.65?(type>.45?0:2):(type>.43?1:0);size=.61+.29*scale;treeLocations.push(p)
    }else if(luck<(s.near<2.3?.62:grass?.047:s.wet?.16:.12)){
      k='rock';v=s.near<2.6||s.wet?2:type<.43?0:type<.77?1:2;size=.40+.75*scale
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
  const gr=grain(),flow=flowMap(),landMat=surfaceMaterial(gr,flow),surface=new T.Mesh(landGeometry(w,creeks,reduced?78:112),landMat)
  surface.receiveShadow=true;group.add(surface)
  const leafMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0,side:T.DoubleSide})
  const props=distribution(w,creeks),batches=new Map<string,Prop[]>()
  const mat=new T.Matrix4(),q=new T.Quaternion(),spin=new T.Quaternion(),scale=new T.Vector3()
  for(const prop of props){const id=prop.kind+prop.v;let bucket=batches.get(id);if(!bucket){bucket=[];batches.set(id,bucket)}bucket.push(prop)}
  const meshes:T.InstancedMesh[]=[]
  for(const [id,items] of batches){
    const mesh=new T.InstancedMesh(specs.get(id)!,leafMat,items.length)
    items.forEach((s,i)=>{
      q.setFromUnitVectors(UP,s.p).multiply(spin.setFromAxisAngle(UP,s.yaw));scale.setScalar(s.size)
      const h=sample(s.p,creeks).bed
      mat.compose(s.p.clone().multiplyScalar(RADIUS+h-(s.kind==='rock'?.035:.018)),q,scale);mesh.setMatrixAt(i,mat)
    })
    mesh.castShadow=!id.startsWith('grass');mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh)
  }
  return {group,surface,creeks,count:props.length,dispose(){surface.geometry.dispose();gr.dispose();flow.dispose();landMat.dispose();leafMat.dispose();meshes.forEach(m=>m.dispose())}}
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

