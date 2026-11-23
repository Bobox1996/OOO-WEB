import * as T from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type Parent = T.Object3D
type Finish = string | T.Material
const cube = new T.BoxGeometry()
const materials = new Map<string,T.MeshStandardMaterial>()
export function paint(color: string) {
  let material = materials.get(color)
  if (!material) {
    material = new T.MeshStandardMaterial({ color, flatShading: true, roughness: .72 })
    materials.set(color, material)
  }
  return material
}
export const lit = (color: string) => new T.MeshBasicMaterial({color})
export function part(parent: Parent, geo: T.BufferGeometry, finish: Finish, x: number,y: number,z: number) {
  const mesh = new T.Mesh(geo, typeof finish === 'string' ? paint(finish) : finish)
  mesh.position.set(x,y,z)
  parent.add(mesh)
  return mesh
}
export function box(p: Parent,x: number,y: number,z: number,w: number,h: number,d: number, m: Finish) {
  const mesh = part(p,cube,m,x,y,z)
  mesh.scale.set(w,h,d)
  return mesh
}
export function group(p: Parent,x=0,y=0,z=0) {
  const g = new T.Group()
  g.position.set(x,y,z); p.add(g); return g
}
export function rod(p: Parent,a: number[],b: number[],r: number,m: Finish,sides=7) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b)
  const axis = end.clone().sub(start)
  const mesh = part(p,new T.CylinderGeometry(r,r,axis.length(),sides),m,...start.add(end).multiplyScalar(.5).toArray() as [number,number,number])
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize())
  return mesh
}
export function ball(p: Parent,x: number,y: number,z: number,w: number,h: number,d: number,m: Finish) {
  const mesh = part(p,new T.SphereGeometry(1,12,8),m,x,y,z)
  mesh.scale.set(w,h,d); return mesh
}
export function texture(w: number,h: number,draw: (c: CanvasRenderingContext2D)=>void) {
  const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h
  draw(canvas.getContext('2d')!)
  const t = new T.CanvasTexture(canvas); t.colorSpace=T.SRGBColorSpace
  return t
}
export function face(p: Parent,x: number,y: number,z: number,w: number,h: number,map: T.Texture) {
  return part(p,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map,transparent:true}),x,y,z)
}
export function lettering(p: Parent,label: string,x: number,y: number,z: number,w: number,h: number,color='#fff1cb',bg?:string) {
  const tex = texture(768,160,c=>{
    if (bg) {c.fillStyle=bg;c.fillRect(0,0,768,160)}
    c.fillStyle=color;c.textBaseline='middle';c.textAlign='center'
    c.font='bold 112px Arial';c.fillText(label,384,86,730)
  })
  return face(p,x,y,z,w,h,tex)
}
export function seeded(seed: number) {
  return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
}

// Combine opaque scenery by lighting model, baking its colors into vertices.
export function batch(root: T.Group) {
  root.updateWorldMatrix(true,true)
  const inverse = root.matrixWorld.clone().invert()
  const bins: T.BufferGeometry[][] = [[],[]], remove: T.Mesh[]=[]
  root.traverse(o=>{
    if (!(o instanceof T.Mesh)) return
    const m=o.material
    if (!(m instanceof T.MeshStandardMaterial || m instanceof T.MeshBasicMaterial) || m.map || m.transparent) return
    const g=o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    g.applyMatrix4(inverse.clone().multiply(o.matrixWorld))
    for (const key of Object.keys(g.attributes)) if (key!=='position' && key!=='normal') g.deleteAttribute(key)
    if (!g.attributes.normal) g.computeVertexNormals()
    const colors=new Float32Array(g.attributes.position.count*3)
    for (let i=0;i<colors.length;i+=3) m.color.toArray(colors,i)
    g.setAttribute('color',new T.BufferAttribute(colors,3))
    bins[Number(m instanceof T.MeshBasicMaterial)].push(g);remove.push(o)
  })
  const used = new Set<T.BufferGeometry>()
  remove.forEach(o=>{o.removeFromParent();used.add(o.geometry)})
  used.forEach(g=>{if(g!==cube)g.dispose()})
  bins.forEach((list,i)=>{
    if(!list.length)return
    const geometry=mergeGeometries(list)!
    root.add(new T.Mesh(geometry,i ? new T.MeshBasicMaterial({vertexColors:true}) :
      new T.MeshStandardMaterial({vertexColors:true,roughness:.79,flatShading:true})))
    list.forEach(g=>g.dispose())
  })
}
export function glowTexture() {
  return texture(128,128,c=>{
    const g=c.createRadialGradient(64,64,0,64,64,64)
    g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.09,'rgba(255,255,255,.55)')
    g.addColorStop(.33,'rgba(255,255,255,.15)');g.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=g;c.fillRect(0,0,128,128)
  })
}
export function glow(p: Parent,map: T.Texture,x:number,y:number,z:number,size:number,color:string,opacity=.7) {
  const s=new T.Sprite(new T.SpriteMaterial({map,color,opacity,transparent:true,depthWrite:false,blending:T.AdditiveBlending}))
  s.position.set(x,y,z);s.scale.set(size,size,1);p.add(s)
}
