import { Vector3 } from 'three/webgpu'

export const RADIUS = 14
export const CELLS = 20
export const RISE = 0.48
export const UP = new Vector3(0, 1, 0)
export type Category = 'tree' | 'rock' | 'grass' | 'sand' | 'creek'
export type Cell = { face: number; i: number; j: number }
export type Stamp = Cell & { kind: Exclude<Category, 'creek'>; variant: number; angle: number }
export type WorldSave = { schema: 1; stamps: Stamp[]; streams: number[] }
export const cleanWorld = (): WorldSave => ({ schema: 1, stamps: [], streams: [0, 1, 2] })
export const label: Record<Category,string> = { tree:'树木', rock:'石头', grass:'草地', sand:'沙地', creek:'小溪' }
export const variants: Record<Category, string[]> = {
  tree:['海岸柏','白桦','风剪松'], rock:['花岗岩','层理岩','溪卵石'],
  grass:['针叶草丛','白花草甸','金穗草'], sand:['细沙','贝屑沙','风纹沙'], creek:['缓弯','双曲','宽浅滩']
}
export const clamp = (x: number, a=0, b=1) => Math.min(b, Math.max(a,x))
export const smooth = (a: number,b: number,x: number) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t) }
export function random(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function hash(x:number,y:number,z:number) {
  let h = Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1442695041)
  h = Math.imul(h ^ (h >>> 13),1274126177);return ((h^(h>>>16))>>>0)/4294967295
}
export function noise(x:number,y:number,z:number) {
  const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z)
  const a=smooth(0,1,x-i),b=smooth(0,1,y-j),c=smooth(0,1,z-k)
  const lerp=(v:number,w:number,t:number)=>v+(w-v)*t
  return lerp(lerp(lerp(hash(i,j,k),hash(i+1,j,k),a),lerp(hash(i,j+1,k),hash(i+1,j+1,k),a),b),
    lerp(lerp(hash(i,j,k+1),hash(i+1,j,k+1),a),lerp(hash(i,j+1,k+1),hash(i+1,j+1,k+1),a),b),c)
}
export const normalAt=(lon:number,lat:number)=>new Vector3(Math.sin(lon)*Math.cos(lat),Math.sin(lat),Math.cos(lon)*Math.cos(lat))
const FACE = [
  [[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],
  [[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],
  [[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]
].map(f=>f.map(v=>new Vector3(v[0],v[1],v[2])))
export function facePoint(face:number,u:number,v:number) {
  const [n,right,up]=FACE[face]
  return n.clone().addScaledVector(right,Math.tan((u-.5)*Math.PI/2)).addScaledVector(up,Math.tan((v-.5)*Math.PI/2)).normalize()
}
export function locate(n:Vector3):Cell {
  let face=0
  for(let f=1;f<6;f++)if(n.dot(FACE[f][0])>n.dot(FACE[face][0])+1e-12)face=f
  const [axis,right,up]=FACE[face],d=n.dot(axis)
  const coord=(s:number)=>clamp(Math.floor((.5+Math.atan(s/d)*2/Math.PI)*CELLS),0,CELLS-1)
  return {face,i:coord(n.dot(right)),j:coord(n.dot(up))}
}
export const center=(c:Cell)=>facePoint(c.face,(c.i+.5)/CELLS,(c.j+.5)/CELLS)
export const key=(c:Cell)=>[c.face,c.i,c.j].join('.')
const LAND = [
  [-.55,.49,.86,.69,1.02],[-1.12,.08,.52,.51,.75],[.65,.86,.67,.56,.99],
  [1.36,.2,.54,.65,.91],[.38,-.78,.53,.36,.8],[-2.43,-.52,.72,.77,.98],
  [2.65,.50,.9,.58,.97],[2.02,-.84,.46,.50,.85],[-.94,-1.19,.34,.30,.72]
].map(([lon,lat,a,b,peak])=>{
  const n=normalAt(lon,lat),x=new Vector3(Math.cos(lon),0,-Math.sin(lon)),y=n.clone().cross(x)
  return {n,x,y,a,b,peak}
})
export function natural(p:Vector3) {
  let field=-1.3
  for(const l of LAND){
    const d=p.dot(l.n);if(d<.35)continue
    const x=p.dot(l.x)/(d*l.a),y=p.dot(l.y)/(d*l.b)
    field=Math.max(field,l.peak*(1-Math.sqrt(x*x+y*y)))
  }
  const relief=(noise(p.x*4+8,p.y*4-2,p.z*4+9)-.5)*.38+(noise(p.x*10,p.y*10+8,p.z*10)-.5)*.10
  const f=field+relief
  // Submerged shelves, a gently graded beach, and three continuous terrace tops.
  let h=clamp(f*6.3,-2.65,.32)
  h+=RISE*smooth(.15,.205,f)+RISE*smooth(.335,.385,f)+RISE*smooth(.54,.61,f)
  h+=clamp(f-.67,0,.35)*.54
  return {f,h}
}
const streamBasins=[0,3,5]
type Creek = {n:Vector3;along:Vector3;across:Vector3;length:number;variant:number;id:number}
export function makeCreeks(styles:number[]):Creek[] {
  return streamBasins.map((idx,i)=>{
    const island=LAND[idx],s=[.63,-.86,.34][i],along=island.x.clone().multiplyScalar(s).addScaledVector(island.y,-1).normalize()
    return {n:island.n,along,across:island.n.clone().cross(along),length:[.93,.87,.98][i],variant:styles[i],id:i}
  })
}
const bend=(t:number,v:number)=>v===0?.068*Math.sin(2.1*Math.PI*t+.24):v===1?.057*Math.sin(3.8*Math.PI*t-.3):.08*Math.sin(1.7*Math.PI*t-.5)
export function creekPoint(c:Creek,t:number,offset=0){
  return c.n.clone().addScaledVector(c.along,(t-.08)*c.length).addScaledVector(c.across,bend(t,c.variant)+offset).normalize()
}
export function sample(p:Vector3,creeks:Creek[]) {
  const {f,h}=natural(p)
  let bed=h, water=0, river=-1, near=9,throat=0,route=-1,waterPlane=0
  for(const c of creeks){
    const d=p.dot(c.n);if(d<.56)continue
    const t=p.dot(c.along)/(d*c.length)+.08;if(t<-.045||t>1.12)continue
    const offset=Math.abs(p.dot(c.across)/d-bend(t,c.variant))
    const w=(.021+.012*clamp(t)+(c.variant===2?.014*smooth(.22,.63,t):0))*smooth(-.045,.035,t)
    const dist=offset/Math.max(.002,w)
    if(dist<near){near=dist;route=c.id}
    if(dist>2.70)continue
    const level=Math.max(0,1.46*(1-smooth(0,.83,t))-.04)
    waterPlane=level*(1-smooth(1.30,1.85,dist))
    const cut=1-smooth(.57,2.65,dist)
    const channelDepth=.095+.07*(1-smooth(.2,1.05,dist))+.092*smooth(.32,.75,t)*(1-smooth(.82,1.04,t))
    bed=h+(Math.min(h,level-channelDepth)-h)*cut
    if(dist<1.85&&bed<waterPlane){water=waterPlane;river=c.id;throat=dist}
    break
  }
  const wet=bed<water
  return {f,bed,water,waterPlane,wet,height:Math.max(water,bed),river,near,route,throat,depth:Math.max(0,water-bed)}
}
export function readSave(raw:string|null):WorldSave{
  if(!raw)return cleanWorld()
  try{
    const w=JSON.parse(raw)
    if(w.schema!==1||!Array.isArray(w.stamps)||!Array.isArray(w.streams)||w.streams.length!==3)return cleanWorld()
    const vi=(v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<3
    const stamps=w.stamps.filter((s:Stamp)=>s&&['rock','tree','grass','sand'].includes(s.kind)&&vi(s.variant)&&Number.isInteger(s.face)&&s.face>=0&&s.face<6&&[s.i,s.j].every(x=>Number.isInteger(x)&&x>=0&&x<CELLS)&&Number.isFinite(s.angle))
    return {schema:1,stamps,streams:w.streams.map((v:unknown,i:number)=>vi(v)?Number(v):i)}
  }catch{return cleanWorld()}
}
