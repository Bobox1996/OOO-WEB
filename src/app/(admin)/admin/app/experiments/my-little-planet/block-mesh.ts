import * as T from 'three/webgpu'
import { BLOCK_HEIGHT as H, MIN_LAYER as MIN, RADIUS, clamp, noise, smooth } from './world'
import { AIR, CORE, GRASS, SAND, WATER, Terrain, charts, edgeUV, pointOn } from './terrain-blocks'
import { seaWind } from './coastal-materials'

function buffers(){return {pos:[] as number[],col:[] as number[],cover:[] as number[],depth:[] as number[],river:[] as number[],flow:[] as number[],index:[] as number[]}}
type Buffers=ReturnType<typeof buffers>
const lawn=new T.Color('#879756'),moss=new T.Color('#677d47'),sand=new T.Color('#e5c997'),wetSand=new T.Color('#bdab87'),creekBed=new T.Color('#819888'),shellSand=new T.Color('#edddbf')
const banks=[new T.Color('#a89975'),new T.Color('#c2aa7f'),new T.Color('#827f65')],tint=new T.Color(),leaf=new T.Color()
const top=(l:number)=>(l+1)*H
const solidMaterial=(m:number)=>m===GRASS||m===SAND
export function blockGeometry(terrain:Terrain,small:boolean){
  const land=buffers(),liquid=buffers(),res=small?4:5
  const cover=Float32Array.from(charts,(_,id)=>terrain.get(id,terrain.solid[id])===GRASS&&terrain.solid[id]>CORE?1:0)
  function grassAt(id:number,u:number,v:number){
    const c=charts[id],left=u<.5,bottom=v<.5,edges=[left?3:1,bottom?0:2],self=cover[id]
    const across=edges.map(e=>Math.abs(terrain.solid[c.adj[e]]-terrain.solid[id])<=1?(self+cover[c.adj[e]])*.5:self)
    const wx=1-smooth(0,.25,Math.min(u,1-u)),wy=1-smooth(0,.25,Math.min(v,1-v))
    return clamp(self+(across[0]-self)*wx+(across[1]-self)*wy)
  }
  function vertex(buf:Buffers,id:number,u:number,v:number,h:number,l:number,side:boolean,floor=false,p?:T.Vector3){
    const n=p??pointOn(id,u,v),m=terrain.get(id,l),river=terrain.streams[id],isWater=buf===liquid
    const grain=noise(n.x*37+9,n.y*37,n.z*37+3),detail=noise(n.x*74,n.y*74+3,n.z*74)
    const surface=terrain.waterAt(id,u,v)
    const depth=isWater?terrain.waterDepthAt(id,u,v,l):terrain.get(id,l+1)===WATER?Math.max(0,surface-h):0
    let grass=0
    if(!isWater){
      if(side||floor||l===CORE){
        tint.copy(banks[m===SAND?1:l===CORE?2:0]).multiplyScalar(.85+grain*.18+.08*Math.cos((h/H)*5.8+grain))
      }else{
        grass=terrain.solid[id]===l?grassAt(id,u,v):m===GRASS?1:0
        const painted=terrain.paint.get(id)
        tint.copy(sand).lerp(wetSand,clamp(1-(h+.15)*1.9))
        if(painted===1)tint.lerp(shellSand,.12+smooth(.62,.86,detail)*.38)
        if(painted===2)tint.multiplyScalar(1+.08*Math.sin((n.x+.56*n.y+.41*n.z)*540+grain*3.2))
        if(river>=0&&depth>.01)tint.lerp(creekBed,.75)
        leaf.copy(lawn).lerp(moss,grain*.8);tint.lerp(leaf,grass).multiplyScalar(.90+grain*.13+detail*.06)
      }
    }
    const r=RADIUS+h;buf.pos.push(n.x*r,n.y*r,n.z*r);buf.depth.push(depth)
    if(isWater){const flow=river>=0?terrain.creeks[river].along:seaWind;buf.flow.push(flow.x,flow.y,flow.z);buf.river.push(river>=0?1:0)}
    else {buf.col.push(tint.r,tint.g,tint.b);buf.cover.push(grass)}
    return buf.pos.length/3-1
  }
  function cap(buf:Buffers,id:number,l:number,bottom=false){
    const start=buf.pos.length/3,wat=buf===liquid,steps=bottom?1:res
    for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){
      const u=i/steps,v=j/steps,h=bottom?l*H:wat?terrain.waterAt(id,u,v,l):terrain.bedAt(id,u,v,l)
      vertex(buf,id,u,v,h,l,false,bottom)
      if(i<steps&&j<steps){
        const a=start+j*(steps+1)+i,b=a+1,c=a+steps+1,d=c+1
        if(bottom)buf.index.push(a,d,b,a,c,d);else buf.index.push(a,b,d,a,d,c)
      }
    }
  }
  function wall(buf:Buffers,id:number,l:number,e:number){
    const wat=buf===liquid,target=charts[id].adj[e],otherEdge=charts[target].adj.indexOf(id)
    const ownMax=wat?terrain.water[id]:terrain.solid[id],nearTop=wat?terrain.water[target]:terrain.solid[target]
    if(l===ownMax&&l===nearTop+1&&(!wat||nearTop>CORE))return
    const start=buf.pos.length/3
    for(let i=0;i<=res;i++){
      const t=i/res,[u,v]=edgeUV(e,t),[nu,nv]=edgeUV(otherEdge,1-t)
      let high=wat?terrain.waterAt(id,u,v,l):terrain.bedAt(id,u,v,l),low=l*H
      if(l===nearTop+1&&(!wat||nearTop>CORE))low=wat?terrain.waterAt(target,nu,nv):terrain.bedAt(target,nu,nv)
      if(wat&&terrain.solid[target]>=l-1)low=Math.max(low,terrain.bedAt(target,nu,nv))
      low=Math.min(low,high)
      const p=pointOn(id,u,v);vertex(buf,id,u,v,low,l,true,false,p);vertex(buf,id,u,v,high,l,true,false,p)
      if(i<res){const a=start+i*2;buf.index.push(a,a+2,a+3,a,a+3,a+1)}
    }
  }
  for(let id=0;id<charts.length;id++){
    if(terrain.solid[id]===CORE||terrain.get(id,MIN)===AIR||terrain.get(id,MIN)===WATER)cap(land,id,CORE)
    for(let l=MIN;l<=terrain.cap;l++){
      const m=terrain.get(id,l);if(m===AIR)continue
      const wat=m===WATER,buf=wat?liquid:land,up=terrain.get(id,l+1),down=terrain.get(id,l-1)
      if(wat?up===AIR:!solidMaterial(up))cap(buf,id,l)
      if(l>MIN&&(wat?down===AIR:!solidMaterial(down)))cap(buf,id,l,true)
      for(let e=0;e<4;e++){
        const other=terrain.get(charts[id].adj[e],l)
        if(wat?other===AIR:!solidMaterial(other))wall(buf,id,l,e)
      }
    }
  }
  function finish(b:Buffers,water:boolean){
    const g=new T.BufferGeometry(),attr=(v:number[],n:number)=>new T.Float32BufferAttribute(v,n)
    g.setAttribute('position',attr(b.pos,3));g.setAttribute('waterDepth',attr(b.depth,1))
    if(water){g.setAttribute('currentDirection',attr(b.flow,3));g.setAttribute('riverWeight',attr(b.river,1))}
    else{g.setAttribute('color',attr(b.col,3));g.setAttribute('grassCover',attr(b.cover,1))}
    g.setIndex(b.index);g.computeVertexNormals();g.computeBoundingSphere();return g
  }
  return {ground:finish(land,false),water:finish(liquid,true)}
}
