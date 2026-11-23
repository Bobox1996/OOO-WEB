import * as T from 'three'
import { ball, batch, box, group, lettering, lit, part, rod, type Parent } from './geometry'

function panel(p:Parent,points:number[][],color:string) {
  const verts:number[]=[]
  for(let i=1;i<points.length-1;i++)verts.push(...points[0],...points[i],...points[i+1])
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals()
  const m=new T.MeshStandardMaterial({color,side:T.DoubleSide,flatShading:true})
  const mesh=part(p,g,m,0,0,0);return mesh
}
export function truck(p:Parent) {
  const g=group(p,0,0,4)
  // Long stainless-steel wedge, single roof apex, sail panels and black tonneau.
  const profile=[[-2.83,.67],[-2.8,1.12],[-1.55,1.32],[-.12,2.12],[.57,2.01],[2.73,1.36],[2.77,.72]]
  for(const s of [-1,1]){
    const x=s*1.16
    panel(g,profile.map(([z,y])=>[x,y,z]),s>0?'#aab6bb':'#85969e')
    panel(g,[[-1.43,1.34],[-.11,2.025],[.52,1.94],[1.69,1.52]].map(([z,y])=>[s*1.169,y,z]),'#344956')
    rod(g,[s*1.18,1.41,.2],[s*1.18,1.97,.14],.047,'#525e64')
    for(const z of [-1.41,.23,1.56])rod(g,[s*1.171,.8,z],[s*1.171,1.4,z+.08],.013,'#576269',4)
    for(const z of [-1.77,1.76]) {
      const wheel=part(g,new T.CylinderGeometry(.59,.59,.33,12),'#202b32',s*1.17,.63,z)
      wheel.rotation.z=Math.PI/2
      const rim=part(g,new T.CylinderGeometry(.37,.37,.035,7),'#596875',s*1.35,.63,z)
      rim.rotation.z=Math.PI/2
      const hub=part(g,new T.CylinderGeometry(.2,.2,.04,6),'#34444c',s*1.38,.63,z)
      hub.rotation.z=Math.PI/2
      for(let i=0;i<4;i++){
        const a=Math.PI*i/4,b=Math.PI*(i+1)/4
        rod(g,[s*1.22,.63+.66*Math.sin(a),z+.66*Math.cos(a)],[s*1.22,.63+.66*Math.sin(b),z+.66*Math.cos(b)],.08,'#36444b',4)
      }
    }
    box(g,s*1.27,1.43,-1.06,.26,.14,.32,'#74838a')
    box(g,s*1.17,.61,0,.16,.14,2.08,'#374548')
  }
  for(let i=0;i<profile.length-1;i++){
    const [a,y]=profile[i],[b,v]=profile[i+1]
    panel(g,[[-1.16,y,a],[1.16,y,a],[1.16,v,b],[-1.16,v,b]],['#7c8991','#a6b5bc','#526a77','#637a85','#52616b','#88969a'][i])
  }
  for(let i=0;i<14;i++){const z=.64+i*.147;rod(g,[-1.09,2.001-(z-.57)*.3,z],[1.09,2.001-(z-.57)*.3,z],.018,'#3f4d59',4)}
  box(g,0,1.075,-2.822,2.29,.065,.031,lit('#d6fcff'))
  box(g,0,1.23,2.754,2.25,.067,.043,lit('#ff705c'))
  box(g,0,.72,2.77,2.24,.15,.15,'#384650')
  lettering(g,'OOO',0,.98,2.8,.39,.16,'#36464d','#c1c9b7')
  // Reverse winding on the far side of the faceted body before batching.
  g.traverse(o=>{
    if(o instanceof T.Mesh && o.material.side===T.DoubleSide) {
      const geo=o.geometry.clone(),pos=geo.getAttribute('position')
      const reversed:number[]=[]
      for(let i=0;i<pos.count;i+=3)for(const j of [i,i+2,i+1])reversed.push(pos.getX(j),pos.getY(j),pos.getZ(j))
      geo.setAttribute('position',new T.Float32BufferAttribute(reversed,3));geo.computeVertexNormals()
      o.userData.reverse=geo
    }
  })
  const panels=g.children.filter(o=>o.userData.reverse) as T.Mesh[]
  panels.forEach(o=>g.add(new T.Mesh(o.userData.reverse,o.material)))
  batch(g);return g
}

const coats=['#e4a348','#84a69b','#ba7c7a','#7c91ad']
const skin=['#be8f72','#dcad85','#ac7964','#daae92']
export function figure(p:Parent,umbrella:boolean,variant=0) {
  const g=group(p),i=variant%4
  const legs=[-.18,.18].map(x=>{
    const leg=group(g,x,.61,0)
    box(leg,0,-.18,0,.19,.45,.22,'#485661')
    box(leg,0,-.44,.04,.24,.17,.34,'#343f49');batch(leg);return leg
  })
  const upper=group(g)
  part(upper,new T.CylinderGeometry(.255,.39,.62,9),coats[i],0,.92,0)
  ball(upper,0,1.58,0,.41,.4,.35,skin[i])
  ball(upper,0,1.76,-.04,.42,.28,.36,['#463d3b','#51423e','#343744','#6c5042'][i])
  for(const s of [-1,1]){
    ball(upper,s*.14,1.58,.322,.042,.057,.027,'#343539')
    ball(upper,s*.25,1.48,.267,.07,.031,.027,'#c6897b')
    const arm=box(upper,s*.33,1.03,.015,.17,.41,.21,coats[i]);arm.rotation.z=s*.32
    ball(upper,s*.39,.87,.04,.095,.12,.105,skin[i])
  }
  if(umbrella){
    rod(upper,[.35,.98,.1],[.35,2.52,.1],.025,'#acb7b6')
    const colors=['#edba58','#cd8640','#dda04b']
    for(let j=0;j<10;j++){
      const tri=(a:number,r:number,y:number)=>[.23+r*Math.cos(a),y,.02+r*Math.sin(a)]
      const a=j*Math.PI/5,b=(j+1)*Math.PI/5
      const pts=[tri(a,0,2.57),tri(b,.54,2.44),tri(a,.54,2.44)]
      panel(upper,pts,colors[j%3])
      panel(upper,[tri(a,.54,2.44),tri(b,.54,2.44),tri(b,.86,2.18),tri((a+b)/2,.85,2.23),tri(a,.86,2.18)],colors[j%3])
    }
    ball(upper,.23,2.58,.02,.055,.063,.055,'#625447')
  }
  batch(upper);return {g,legs,upper}
}
