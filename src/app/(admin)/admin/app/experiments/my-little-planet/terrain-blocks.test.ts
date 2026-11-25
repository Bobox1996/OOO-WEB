import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { BLOCK_EDGE, BLOCK_HEIGHT, MAX_LAYER, MIN_LAYER, WorldSave, cleanWorld, readSave } from './world'
import { AIR, GRASS, SAND, WATER, cellId, charts, createTerrain, edgeUV, pointOn } from './terrain-blocks'

const id=cellId({face:4,i:19,j:10}),edge=1,other=charts[id].adj[edge],opposite=charts[other].adj.indexOf(id)
function terrace(a:number,b:number):WorldSave{
  const w=cleanWorld()
  for(const [idx,top] of [[id,a],[other,b]]){
    const {face,i,j}=charts[idx]
    for(let layer=MIN_LAYER;layer<=MAX_LAYER;layer++)w.blocks.push({face,i,j,layer,material:layer<=top?'grass':null})
  }
  return w
}
test('every edge has a reciprocal neighbour and shared coordinates across cube seams',()=>{
  assert.equal(charts.length,2400);assert.equal(BLOCK_HEIGHT,BLOCK_EDGE/2)
  assert.notEqual(charts[id].face,charts[other].face)
  for(let a=0;a<charts.length;a++)for(let e=0;e<4;e++){
    const b=charts[a].adj[e],back=charts[b].adj.indexOf(a);assert.ok(back>=0)
    assert.ok(pointOn(a,...edgeUV(e,.32)).distanceTo(pointOn(b,...edgeUV(back,.68)))<1e-9)
  }
})
test('one half-block is continuous and passable in both directions across a seam',()=>{
  const t=createTerrain(terrace(1,2))
  assert.equal(t.traverse(charts[id].p,charts[other].p,1)?.layer,2)
  assert.equal(t.traverse(charts[other].p,charts[id].p,2)?.layer,1)
  for(let n=0;n<=8;n++){
    const k=n/8
    assert.ok(Math.abs(t.bedAt(id,...edgeUV(edge,k))-t.bedAt(other,...edgeUV(opposite,1-k)))<1e-8)
  }
  const h=t.bedAt(id,...edgeUV(edge,.5));assert.ok(h>2*BLOCK_HEIGHT&&h<3*BLOCK_HEIGHT)
})
test('a full cell width of rise or drop blocks walking in either direction',()=>{
  for(const d of [2,3]){
    const t=createTerrain(terrace(0,d))
    assert.equal(t.traverse(charts[id].p,charts[other].p,0),null)
    assert.equal(t.traverse(charts[other].p,charts[id].p,d),null)
  }
})
test('individual water, sand and air survive serialization, including a buried cut and a slice',()=>{
  let w=terrace(1,1),t=createTerrain(w)
  const modify=(action:'add'|'paint'|'dig',material:'grass'|'sand'|'water',level:number|null)=>{
    const edit=t.edit(id,{action,material,level})
    assert.ok(edit.world);w=edit.world;t=createTerrain(w)
  }
  modify('dig','grass',-2);assert.equal(t.get(id,-2),AIR);assert.equal(t.get(id,-1),GRASS)
  modify('add','water',-2);assert.equal(t.get(id,-2),WATER);assert.equal(t.get(other,-2),GRASS)
  modify('paint','sand',-2);assert.equal(t.get(id,-2),SAND)
  modify('add','water',null);assert.equal(t.get(id,2),WATER);assert.equal(t.support(charts[id].p,1)?.wet,true)
  modify('add','water',null);assert.equal(t.support(charts[id].p,1),null)
  const slice=createTerrain(w,-2);assert.equal(slice.get(id,-2),SAND);assert.equal(slice.get(id,1),AIR)
  const restored=createTerrain(readSave(JSON.stringify(w)));assert.equal(restored.get(id,1),GRASS);assert.equal(restored.get(id,3),WATER)
})
test('schema 1 retains authored props and routes; duplicate edits remain canonical',()=>{
  const stamp={face:4,i:7,j:9,kind:'rock',variant:2,angle:.8}
  const w=readSave(JSON.stringify({schema:1,streams:[2,1,0],stamps:[stamp]}))
  assert.equal(w.schema,2);assert.deepEqual(w.blocks,[]);assert.deepEqual(w.stamps,[stamp]);assert.deepEqual(w.streams,[2,1,0])
  const a={face:4,i:7,j:9,layer:1,material:'grass'},b={...a,material:null}
  assert.deepEqual(readSave(JSON.stringify({...w,blocks:[a,b,{...a,layer:700}]})).blocks,[b])
})
test('an isolated water block is half a cell deep when there is air below',()=>{
  const w=terrace(0,0),{face,i,j}=charts[id];w.blocks.push({face,i,j,layer:5,material:'water'})
  const t=createTerrain(w)
  assert.ok(Math.abs(t.waterDepthAt(id,.5,.5)-BLOCK_HEIGHT)<1e-9)
  assert.equal(t.get(id,4),AIR);assert.equal(t.sample(charts[id].p).submerged,false)
  assert.equal(t.support(charts[id].p,0)?.layer,0)
})
test('a tunnel with three clear half-layers is passable and a low opening blocks',()=>{
  const w=terrace(0,0),{face,i,j}=charts[id];w.blocks.push({face,i,j,layer:4,material:'grass'})
  assert.equal(createTerrain(w).support(charts[id].p,0)?.layer,0)
  w.blocks.push({face,i,j,layer:2,material:'sand'})
  assert.equal(createTerrain(w).support(charts[id].p,0),null)
})
