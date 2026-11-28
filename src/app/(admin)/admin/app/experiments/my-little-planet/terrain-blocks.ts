import { Vector3 } from 'three/webgpu'
import { BLOCK_HEIGHT as H, CELLS as N, MIN_LAYER as MIN, MAX_LAYER as MAX, RADIUS, BlockEdit, BlockKind, Cell, WorldSave, center, clamp, creekPoint, facePoint, key, localCoords, makeCreeks, sample as seedSample, smooth } from './world'

export const AIR=0, GRASS=1, SAND=2, WATER=3, CORE=MIN-1
export const kinds=[null,'grass','sand','water'] as const
export const cellId=(c:Cell)=>c.face*N*N+c.j*N+c.i
const layers=MAX-MIN+1, count=6*N*N
const address=(id:number,l:number)=>id*layers+l-MIN
const topHeight=(l:number)=>(l+1)*H
export type BlockTool={material:BlockKind;action:'add'|'dig'|'paint';level:number|null}
export type Pick={id:number;layer:number;before:BlockKind|null}
type Chart={face:number;i:number;j:number;p:Vector3;corners:number[];adj:number[]}
const grid:Chart[]=[],points:Vector3[]=[],incident:number[][]=[],vertexIndex=new Map<string,number>()
const edges=new Map<string,[number,number]>()
for(let f=0;f<6;f++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const id=grid.length,coords={face:f,i,j},corners:number[]=[]
  for(const [dx,dy] of [[0,0],[1,0],[1,1],[0,1]]){
    const p=facePoint(f,(i+dx)/N,(j+dy)/N),key=p.toArray().map(s=>Math.round(s*1e7)).join('/')
    let v=vertexIndex.get(key)
    if(v===undefined){v=points.length;points.push(p);vertexIndex.set(key,v);incident.push([])}
    corners.push(v);incident[v].push(id)
  }
  const cell={...coords,p:center(coords),corners,adj:[-1,-1,-1,-1]};grid.push(cell)
  for(let e=0;e<4;e++){
    const a=corners[e],b=corners[(e+1)%4],key=Math.min(a,b)+'/'+Math.max(a,b),prev=edges.get(key)
    if(prev){cell.adj[e]=prev[0];grid[prev[0]].adj[prev[1]]=id}else edges.set(key,[id,e])
  }
}
export const charts:readonly Chart[]=grid
export const cellAt=(p:Vector3)=>cellId(localCoords(p))
export function pointOn(id:number,u:number,v:number){const c=grid[id];return facePoint(c.face,(c.i+u)/N,(c.j+v)/N)}
export function edgeUV(edge:number,t:number):[number,number]{return edge===0?[t,0]:edge===1?[1,t]:edge===2?[1-t,1]:[0,1-t]}
export type Terrain=ReturnType<typeof createTerrain>
export function createTerrain(w:WorldSave,limit=MAX){
  const creeks=makeCreeks(w.streams),original=new Uint8Array(count*layers)
  const streams=new Int8Array(count).fill(-1),stages=new Int8Array(count),paint=new Map(w.stamps.filter(s=>s.kind==='sand').map(s=>[cellId(s),s.variant]))
  const seed=grid.map(c=>seedSample(c.p,creeks))
  // Trace through grid cells, adding the edge-adjacent intermediate cell at a diagonal turn.
  for(const c of creeks){
    let previous=-1
    for(let k=0;k<=124;k++){
      const t=k/124,p=creekPoint(c,t),id=cellAt(p)
      if(seed[id].f<-.065&&t>.5)break
      const stage=Math.max(0,Math.round(Math.max(0,1.46*(1-smooth(0,.83,t))-.04)/H))
      const mark=(i:number)=>{streams[i]=c.id;stages[i]=stage}
      if(previous>=0&&id!==previous&&!grid[previous].adj.includes(id)){
        const between=grid[previous].adj.filter(n=>grid[id].adj.includes(n)).sort((a,b)=>grid[b].p.dot(p)-grid[a].p.dot(p))[0]
        if(between!==undefined)mark(between)
      }
      mark(id);previous=id
    }
  }
  // Give the generated shoreline room for reeds and shingle. These caps apply to the
  // seed only; authored cliffs and independent water blocks retain their exact levels.
  const shoulders=new Int8Array(count).fill(MAX+4)
  for(let id=0;id<count;id++)if(streams[id]>=0){
    for(const bank of grid[id].adj){
      shoulders[bank]=Math.min(shoulders[bank],stages[id])
      for(const upland of grid[bank].adj)shoulders[upland]=Math.min(shoulders[upland],stages[id]+1)
    }
  }
  for(let id=0;id<count;id++){
    const s=seed[id],stream=streams[id]>=0
    let surface=Math.round(s.bed/H)
    const shore=s.f<.123
    if(!stream&&s.bed<0)surface=Math.min(-1,surface)
    if(!stream&&s.bed>=0)surface=Math.min(surface,shoulders[id])
    const beach=s.f<.155&&s.bed>=0&&grid[id].adj.some(n=>seed[n].bed<0&&streams[n]<0)
    if(beach)surface=Math.min(surface,0)
    if(!stream&&s.bed<0&&grid[id].adj.some(n=>seed[n].bed>=0&&seed[n].f<.155))surface=-1
    if(stream)surface=Math.min(surface,stages[id]-1)
    const waterTop=stream?stages[id]:0
    for(let l=MIN;l<=MAX;l++){
      const top=l+1
      const solid=shore||stream||paint.has(id)&&top===surface?SAND:GRASS
      original[address(id,l)]=top<=surface?solid:top<=waterTop?WATER:AIR
    }
  }
  const actual=original.slice()
  for(const b of w.blocks)actual[address(cellId(b),b.layer)]=kinds.indexOf(b.material)
  const cap=Math.round(clamp(limit,MIN,MAX))
  const get=(id:number,l:number)=>l<MIN?GRASS:l>cap?AIR:actual[address(id,l)]
  const solid=new Int8Array(count).fill(CORE),water=new Int8Array(count).fill(CORE),outer=new Int8Array(count).fill(CORE)
  for(let id=0;id<count;id++)for(let l=MIN;l<=cap;l++){
    const v=get(id,l)
    if(v>0)outer[id]=l
    if(v===GRASS||v===SAND)solid[id]=l
    if(v===WATER)water[id]=l
  }
  function profiles(heights:Int8Array,liquid:boolean,land?:Float32Array){
    const values=new Float32Array(count*9)
    for(let id=0;id<count;id++){
      const c=grid[id],h=heights[id],base=id*9;values[base]=h
      for(let e=0;e<4;e++){
        const n=c.adj[e],nh=heights[n]
        let y=h
        if(liquid&&nh===CORE){
          if(solid[n]>=h-1)y=Math.min(h,land![base+1+e])
        }else if(Math.abs(h-nh)<=1)y=(h+nh)*.5
        values[base+1+e]=y
      }
    }
    // All cells in an edge-connected group at a physical corner use the identical vertex.
    for(const cells of incident){
      const done=new Set<number>()
      for(const start of cells){
        if(done.has(start))continue
        const group=[start];done.add(start)
        for(let ix=0;ix<group.length;ix++){
          const a=group[ix]
          for(const b of cells)if(!done.has(b)&&grid[a].adj.includes(b)&&Math.abs(heights[a]-heights[b])<=1&&(!liquid||heights[b]!==CORE&&heights[a]!==CORE)){group.push(b);done.add(b)}
        }
        let v=group.reduce((sum,i)=>sum+heights[i],0)/group.length
        for(const id of group){const corner=grid[id].corners.findIndex(k=>incident[k]===cells)
          if(liquid&&heights[id]>CORE&&cells.some(n=>heights[n]===CORE&&solid[n]>=heights[id]-1))v=Math.min(v,land![id*9+5+corner])
        }
        for(const id of group){const corner=grid[id].corners.findIndex(k=>incident[k]===cells);values[id*9+5+corner]=v}
      }
    }
    return values
  }
  const groundShape=profiles(solid,false),waterShape=profiles(water,true,groundShape)
  function shape(values:Float32Array,id:number,u:number,v:number){
    const i=id*9,left=u<.5,bottom=v<.5
    const wx=1-smooth(0,.46,Math.min(u,1-u)),wy=1-smooth(0,.46,Math.min(v,1-v))
    const x=values[i+1+(left?3:1)],y=values[i+1+(bottom?0:2)],corner=values[i+5+(bottom?(left?0:1):(left?3:2))]
    const row=values[i]*(1-wx)+x*wx,edge=y*(1-wx)+corner*wx
    return topHeight(row*(1-wy)+edge*wy)
  }
  function bedAt(id:number,u:number,v:number,l=solid[id]){return l===solid[id]?shape(groundShape,id,u,v):topHeight(l)}
  function waterAt(id:number,u:number,v:number,l=water[id]){return l===water[id]?shape(waterShape,id,u,v):topHeight(l)}
  function waterDepthAt(id:number,u:number,v:number,layer=water[id]){
    if(layer<MIN||get(id,layer)!==WATER)return 0
    let bottom=layer
    while(bottom>MIN&&get(id,bottom-1)===WATER)bottom--
    const m=get(id,bottom-1)
    const floor=m===SAND||m===GRASS?bedAt(id,u,v,bottom-1):bottom*H
    return Math.max(0,waterAt(id,u,v,layer)-floor)
  }
  function sample(p:Vector3){
    const loc=localCoords(p),id=cellId(loc),s=seed[id],bed=bedAt(id,loc.u,loc.v)
    const visible=water[id]>solid[id],plane=visible?waterAt(id,loc.u,loc.v):bed,depth=visible?waterDepthAt(id,loc.u,loc.v):0
    const material=solid[id]===CORE?null:kinds[get(id,solid[id])]
    return {id,bed,height:Math.max(bed,plane),water:plane,waterPlane:plane,wet:visible&&depth>.012,submerged:get(id,solid[id]+1)===WATER,depth,river:visible?streams[id]:-1,
      route:streams[id]>=0?streams[id]:s.route,near:streams[id]>=0?0:s.near,f:material==='grass'?Math.max(.20,s.f):Math.min(.099,s.f),material}
  }
  function support(p:Vector3,from:number,head=1.44){
    const uv=localCoords(p),id=cellId(uv)
    // Count real layers before applying surface interpolation. A two-layer cliff blocks both directions.
    for(const l of [from,from+1,from-1]){
      if(l<CORE||l>cap||get(id,l)===WATER||get(id,l)===AIR)continue
      let ceiling=Infinity,waterDepth=0
      for(let k=l+1;k<=cap;k++){
        const m=get(id,k)
        if(m===SAND||m===GRASS){ceiling=k*H;break}
        if(m===WATER&&k===l+1+waterDepth)waterDepth++
      }
      const height=bedAt(id,uv.u,uv.v,l)
      if(ceiling-height<head-.025||waterDepth>=2)continue
      return {layer:l,height,wet:waterDepth===1}
    }
    return null
  }
  function traverse(from:Vector3,to:Vector3,level:number){
    const a=cellAt(from),b=cellAt(to),goal=support(to,level)
    if(!goal||a===b||grid[a].adj.includes(b))return goal
    const connected=grid[a].adj.some(mid=>{
      if(!grid[b].adj.includes(mid))return false
      const via=support(grid[mid].p,level)
      return !!via&&!!support(to,via.layer)
    })
    return connected?goal:null
  }
  function cameraFloor(p:Vector3,elevation:number){
    const {face,i,j,u,v}=localCoords(p),id=cellId({face,i,j})
    for(let k=cap;k>=CORE;k--){
      const m=get(id,k)
      if(m!==GRASS&&m!==SAND||k>CORE&&elevation<k*H-.01)continue
      return bedAt(id,u,v,k)
    }
    return topHeight(CORE)
  }
  function target(id:number,tool:BlockTool):Pick{
    const layer=tool.level??(outer[id]+(tool.action==='add'?1:0))
    return {id,layer,before:layer<MIN||layer>MAX?null:kinds[get(id,layer)]}
  }
  function edit(id:number,tool:BlockTool){
    const {layer,before}=target(id,tool),landing=grid[id]
    if(layer<MIN||layer>MAX)return {reason:'已到可编辑层边界。'}
    if(tool.action==='add'&&before!==null)return {reason:'这一格已有模块。请选择空层或使用换材。'}
    if(tool.action!=='add'&&before===null)return {reason:'所选层是空的。'}
    const material=tool.action==='dig'?null:tool.material
    if(before===material)return {reason:'这一块已经是所选材料。'}
    const changes=w.blocks.filter(b=>cellId(b)!==id||b.layer!==layer)
    if(material!==kinds[original[address(id,layer)]])changes.push({face:landing.face,i:landing.i,j:landing.j,layer,material})
    return {world:{...w,blocks:changes},layer}
  }
  return {creeks,get,solid,water,outer,cap,streams,seed,paint,bedAt,waterAt,waterDepthAt,sample,support,traverse,cameraFloor,target,edit}
}
