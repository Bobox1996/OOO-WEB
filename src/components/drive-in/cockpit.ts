import * as T from 'three'
import { seeded, texture } from './geometry'

export function cockpit() {
  const scene=new T.Scene(), camera=new T.OrthographicCamera(-1,1,1,-1,.1,6);camera.position.z=3
  const root=new T.Group();scene.add(root)
  // Painted layers use screen coordinates so the windshield and controls stay framed on narrow phones.
  function shape(p:T.Object3D,points:number[][],z:number,colors:string[]) {
    const verts:number[]=[],rgb:number[]=[]
    const ids=T.ShapeUtils.triangulateShape(points.map(([x,y])=>new T.Vector2(x,y)),[])
    ids.flat().forEach(i=>{verts.push(points[i][0],points[i][1],z);new T.Color(colors[i%colors.length]).toArray(rgb,rgb.length)})
    const g=new T.BufferGeometry()
    g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('color',new T.Float32BufferAttribute(rgb,3))
    p.add(new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})))
  }
  const dash=[[-1,-.36],[-.65,-.28],[.53,-.25],[1,-.16],[1,-1],[-1,-1]]
  shape(root,dash,.2,['#1d2e36','#55616c','#58636a','#394750','#111c25','#131e25'])
  shape(root,[[-1,-.39],[-.61,-.355],[.56,-.33],[1,-.23],[1,-.295],[.57,-.40],[-.62,-.43],[-1,-.48]],.22,['#687680','#748691','#76858c','#667780','#475660','#434f57'])
  shape(root,[[-1,-.476],[-.62,-.43],[.57,-.40],[1,-.295],[1,-.307],[.57,-.413],[-.62,-.443],[-1,-.49]],.23,['#759b9c','#d0ad91','#f4b691','#759697'])
  shape(root,[[-1,-.506],[-.62,-.46],[.57,-.424],[1,-.322],[1,-.555],[.4,-.62],[-.6,-.63],[-1,-.66]],.24,['#111d28','#283543','#344352','#283641','#25303a','#111d28'])
  // Raked A-pillars and roof headliner surround the windshield.
  for(const s of [-1,1]){
    const pts=(a:number[][])=>a.map(([x,y])=>[s*x,y])
    shape(root,pts([[.76,1],[.9,1],[1,.41],[1,-.35],[.973,-.28],[.915,.28]]),.34,['#293640','#202b32','#232f3b','#46545d','#52606a','#303e4a'])
    shape(root,pts([[.749,1],[.766,1],[.921,.28],[.981,-.27],[.97,-.27],[.906,.28]]),.35,['#43515b','#849399','#637780','#45565d'])
    shape(root,pts([[.875,1],[1,1],[1,.30]]),.35,['#0f1721','#08121a','#202e3b'])
  }
  shape(root,[[-1,1],[1,1],[1,.90],[.72,.913],[.21,.944],[-.45,.918],[-.84,.876],[-1,.84]],.36,['#111b24','#101923','#172632','#23323c','#24313b','#17252f'])
  const wheel=new T.Group();root.add(wheel)
  const rim=[[-.52,-.39],[-.65,-.13],[-.60,.21],[-.43,.38],[.37,.39],[.57,.28],[.64,.06],[.55,-.26],[.37,-.44],[-.27,-.46]]
  const inside=rim.map(([x,y])=>[x*.817,y*.714])
  for(let i=0;i<rim.length;i++){
    const j=(i+1)%rim.length
    shape(wheel,[rim[i],rim[j],inside[j],inside[i]],.52,[i<6?'#52606b':'#25323c',i<5?'#62717c':'#33414b','#1b252f','#22303b'])
    const edge=rim.map(([x,y])=>[x*.974,y*.964])
    shape(wheel,[rim[i],rim[j],edge[j],edge[i]],.53,['#677680','#4e5963','#34404b'])
  }
  shape(wheel,[[-.53,.002],[-.16,-.025],[.16,-.018],[.51,.05],[.48,-.089],[.22,-.205],[.085,-.39],[-.12,-.39],[-.24,-.185],[-.49,-.125]],.55,['#394651','#62707a','#62727d','#45555f','#35424d','#202e37'])
  shape(wheel,[[-.28,-.057],[-.18,.024],[.18,.026],[.29,-.046],[.18,-.199],[-.16,-.21]],.56,['#34424d','#56616a','#5a6773','#384650','#293743','#27343e'])
  for(const s of [-1,1]){
    shape(wheel,[[s*.33,-.026],[s*.43,-.013],[s*.425,-.074],[s*.33,-.084]],.58,['#17232c','#29333c'])
    for(let j=0;j<3;j++)shape(wheel,[[s*(.35+j*.025),-.041],[s*(.358+j*.025),-.04],[s*(.358+j*.025),-.055],[s*(.35+j*.025),-.057]],.59,['#93a5aa'])
  }
  const dashMark=texture(240,70,c=>{c.fillStyle='#a9bcc3';c.font='bold italic 40px Arial';c.textAlign='center';c.fillText('C Y B R',120,47)})
  const badge=new T.Mesh(new T.PlaneGeometry(.25,.073),new T.MeshBasicMaterial({map:dashMark,transparent:true,depthWrite:false}))
  badge.position.set(0,-.094,.6);wheel.add(badge)
  const rain=texture(960,540,c=>{
    const r=seeded(505)
    for(let j=0;j<540;j++){
      const x=r()*960,y=r()*540,sz=.35+Math.pow(r(),3)*2.6
      c.beginPath();c.ellipse(x,y,sz,sz*1.52,-.22,0,Math.PI*2);c.fillStyle='rgba(9,24,40,.29)';c.fill()
      c.beginPath();c.ellipse(x,y-.3,sz*.76,sz*.91,-.22,3.45,5.4);c.strokeStyle='rgba(210,231,232,.48)';c.lineWidth=.62;c.stroke()
      if(j%16===0){c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-2,y-10,x+1,y-18);c.strokeStyle='rgba(197,215,218,.13)';c.stroke()}
    }
  })
  const glass=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({map:rain,transparent:true,depthWrite:false}));glass.position.z=.05;root.add(glass)
  return {scene,camera,resize(aspect:number){wheel.scale.set(.99/aspect,.99,1);wheel.position.set(aspect<.9?-.85:-.49,-.89,0)}}
}
