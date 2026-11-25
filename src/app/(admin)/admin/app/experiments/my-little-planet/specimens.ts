import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, Vector3, Color } from 'three/webgpu'
import { Category, clamp, noise, random } from './world'

type V = Vector3
const pt=(x=0,y=0,z=0)=>new Vector3(x,y,z)
const tint=(hex:string)=>new Color(hex)
const spheres=[0,1,2].map(i=>new IcosahedronGeometry(1,i).getAttribute('position'))
type MeshData={p:number[];n:number[];c:number[]}
function builder(seed:number){
  const rng=random(seed), data:MeshData={p:[],n:[],c:[]}
  function vert(p:V,n:V,c:Color){
    data.p.push(p.x,p.y,p.z);data.n.push(n.x,n.y,n.z);data.c.push(c.r,c.g,c.b)
  }
  function tri(a:V,b:V,c:V,ca:Color,cb=ca,cc=ca){
    const norm=b.clone().sub(a).cross(c.clone().sub(a)).normalize()
    vert(a,norm,ca);vert(b,norm,cb);vert(c,norm,cc)
  }
  function puff(o:V,s:V,col:Color,detail=1,rough=.12,seedPhase=rng()*32,flatten=false){
    const pos=spheres[detail],k=pt(),points:V[]=[],norms:V[]=[],colors:Color[]=[]
    for(let i=0;i<pos.count;i++){
      k.fromBufferAttribute(pos,i)
      const blob=1+rough*(noise(k.x*3.1+seedPhase,k.y*3.1,k.z*3.1+2)-.5)*2
      const y=flatten?clamp(k.y,-.61,.79):k.y
      points.push(pt(k.x*s.x*blob+o.x,y*s.y*blob+o.y,k.z*s.z*blob+o.z))
      norms.push(pt(k.x/s.x,k.y/s.y,k.z/s.z).normalize())
      const grain=noise(k.x*7+seedPhase,k.y*7+4,k.z*7)
      colors.push(col.clone().multiplyScalar(.71+.30*(k.y*.5+.5)+.24*grain))
    }
    for(let i=0;i<points.length;i+=3){
      const plane=points[i+1].clone().sub(points[i]).cross(points[i+2].clone().sub(points[i])).normalize()
      for(let j=i;j<i+3;j++)vert(points[j],norms[j].lerp(plane,flatten?.72:.23).normalize(),colors[j])
    }
  }
  function stem(a:V,b:V,r0:number,r1:number,col:Color,sides=7){
    const axis=b.clone().sub(a).normalize(),t=pt(1,0,0)
    if(Math.abs(axis.x)>.8)t.set(0,0,1)
    const u=t.cross(axis).normalize(),v=u.clone().cross(axis).normalize()
    const ns=Array.from({length:sides},(_,i)=>u.clone().multiplyScalar(Math.cos(i*2*Math.PI/sides)).addScaledVector(v,Math.sin(i*2*Math.PI/sides)))
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides,pi=a.clone().addScaledVector(ns[i],r0),pj=a.clone().addScaledVector(ns[j],r0)
      const qi=b.clone().addScaledVector(ns[i],r1),qj=b.clone().addScaledVector(ns[j],r1)
      const shade=col.clone().multiplyScalar(.88+.15*(i%3)/2)
      for(const [p,n] of [[pi,ns[i]],[pj,ns[j]],[qj,ns[j]],[pi,ns[i]],[qj,ns[j]],[qi,ns[i]]])vert(p,n,shade)
    }
  }
  function blade(x:number,z:number,h:number,w:number,lean:number,ang:number,col:Color){
    const vx=Math.cos(ang),vz=Math.sin(ang),u=pt(-vz*w,0,vx*w),mid=pt(x+vx*lean*.34,h*.58,z+vz*lean*.34)
    const a=pt(x,0,z).sub(u),b=pt(x,0,z).add(u),c=mid.clone().addScaledVector(u,.59),d=mid.clone().addScaledVector(u,-.59),end=pt(x+lean*vx,h,z+lean*vz)
    const dark=col.clone().multiplyScalar(.56),light=col.clone().lerp(tint('#c0c26b'),.2)
    tri(a,b,c,dark,dark,col);tri(a,c,d,dark,col,col);tri(d,c,end,col,col,light)
  }
  function finish(){
    const g=new BufferGeometry()
    for(const [name,arr] of [['position',data.p],['normal',data.n],['color',data.c]] as const)g.setAttribute(name,new Float32BufferAttribute(arr,3))
    g.computeBoundingSphere();return g
  }
  return {rng,tri,puff,stem,blade,finish}
}
export function specimen(kind:Category,variant:number){
  const b=builder(203+variant*197+kind.charCodeAt(0)*13),r=b.rng
  if(kind==='tree'){
    const palettes=[['#435d39','#67804a','#839149'],['#74894d','#93a65e','#adad5b'],['#3c604e','#587959','#718654']]
    const leaf=palettes[variant].map(tint),bark=tint(variant===1?'#d1cbb1':'#715944')
    const upper=variant===0?3.05:variant===1?3.45:2.8
    const bases=variant===1?[pt(-.12,0,0),pt(.13,0,.03)]:[pt()]
    for(const [s,a] of bases.entries()){
      const mid=pt((s-.2)*.26+(variant===2?.17:0),upper*.38,.04),tip=pt((s-.2)*.49+(variant===2?.58:0),upper*.91,-.03)
      b.stem(a,mid,variant===1?.073:.14,variant===1?.049:.095,bark,9);b.stem(mid,tip,variant===1?.05:.095,.018,bark,8)
      if(variant===1)for(let i=0;i<8;i++){
        const t=(i+.5)/10,mark=a.clone().lerp(mid,t)
        b.stem(mark,mark.clone().add(pt(.005,.024,.002)),.073-.025*t,.072-.025*t,tint('#777669'),6)
      }
      const count=variant===1?6:10
      for(let j=0;j<count;j++){
        const t=j/(count-1),theta=j*2.399+s+variant*.44,height=upper*(.42+.46*t)
        const reach=(variant===2?1.26:variant===0?1.04:.58)*(1-.5*t)*(.85+r()*.32)
        const at=mid.clone().lerp(tip,clamp((height-mid.y)/(tip.y-mid.y)))
        const c=pt(at.x+Math.cos(theta)*reach+(variant===2?.30:0),height+.20,at.z+Math.sin(theta)*reach)
        const elbow=at.clone().lerp(c,.57);elbow.y-=.14
        b.stem(at,elbow,.062*(1-.45*t),.036,bark);b.stem(elbow,c,.037,.016,bark,6)
        const size=(variant===1?.51:.67)*(.82+r()*.27)*(1-.22*t)
        const sy=variant===2?.54:variant===1?1.25:.91
        for(let l=0;l<5;l++){
          const an=l*2.399,rad=l===0?0:size*.53,cc=c.clone().add(pt(Math.cos(an)*rad,(r()-.42)*size*.45,Math.sin(an)*rad))
          b.puff(cc,pt(size*.70,size*.65*sy,size*.66),leaf[(j+l)%3],1,.38)
          for(let k=0;k<8;k++){
            const az=r()*Math.PI*2,uy=r()*1.7-.72,rr=Math.sqrt(1-uy*uy)
            const q=cc.clone().add(pt(Math.cos(az)*rr*size*.47,uy*size*.48*sy,Math.sin(az)*rr*size*.47))
            const ss=size*(.13+r()*.13)
            b.puff(q,pt(ss,ss*sy*.82,ss*.9),leaf[(j+l+k)%3],0,.33)
          }
        }
      }
    }
  }else if(kind==='rock'){
    const groups=variant===0?4:variant===1?4:9
    for(let j=0;j<groups;j++){
      const t=j===0?0:j*2.4,rad=j===0?0:(.35+r()*.27),x=Math.cos(t)*rad,z=Math.sin(t)*rad
      const s=variant===2?.14+r()*.21:(j===0?.68:.19+r()*.22)
      const sy=variant===1?s*.62:variant===2?s*.55:s*.83
      const c=pt(x,sy*.51,z),col=tint((variant===0?['#96927e','#aaa48e','#777b69']:variant===1?['#6d746f','#92948a','#7f8174']:['#a9a79a','#888e83','#c0b59c'])[j%3])
      b.puff(c,pt(s,sy,s*(.67+r()*.23)),col,2,variant===2?.10:.28,9+j*3,variant!==2)
      if(variant===1){
        b.puff(c.clone().add(pt(.02,sy*.25,0)),pt(s*.96,sy*.46,s*.71),tint('#b0a996'),1,.17,12+j,true)
        b.puff(c.clone().add(pt(.04,sy*.48,.015)),pt(s*.87,sy*.37,s*.68),tint('#85877a'),1,.16,13+j,true)
      }
      if(variant===0)for(let l=0;l<8;l++){
        const a=r()*6.28,ss=(.06+r()*.09)*s
        b.puff(c.clone().add(pt(Math.cos(a)*s*.55,sy*.71,Math.sin(a)*s*.45)),pt(ss,ss*.26,ss),tint(l%2?'#929748':'#a1a268'),0,.22)
      }
    }
  }else if(kind==='grass'){
    for(let k=0;k<(variant===0?48:38);k++){
      const a=r()*6.283,d=Math.sqrt(r())*.41,x=Math.cos(a)*d,z=Math.sin(a)*d,h=(.17+r()*.29)*(variant===2?1.23:1)
      b.blade(x,z,h,.014+r()*.015,.04+r()*.14,a+r()-.5,tint(['#627d41','#84944b','#a0a65a'][k%3]))
      if(variant===1&&k%4===0){
        const top=pt(x+.045,h*1.25,z);b.stem(pt(x,0,z),top,.009,.005,tint('#828c49'),4)
        for(let a=0;a<5;a++)b.puff(top.clone().add(pt(Math.cos(a*1.26)*.031,0,Math.sin(a*1.26)*.031)),pt(.03,.012,.023),tint('#e6e1c4'),0,.12)
        b.puff(top.clone().add(pt(0,.012,0)),pt(.021,.018,.019),tint('#d7b15b'),0,.11)
      }
      if(variant===2&&k%4===0){
        const top=pt(x+.058,h*1.32,z);b.stem(pt(x,0,z),top,.008,.005,tint('#92914b'),4)
        for(let l=0;l<5;l++)b.puff(top.clone().add(pt(Math.sin(l*2)*.016,-l*.023,Math.cos(l*2)*.014)),pt(.015,.034,.014),tint('#c4a866'),0,.2)
      }
    }
  }else{
    const sand=kind==='sand',c=tint(sand?['#dfc58e','#d2bb91','#d8c096'][variant]:['#7cb3a4','#648f82','#8ec8b4'][variant])
    b.puff(pt(0,.045,0),pt(.73,.08,.53),c,2,.13,4,true)
    for(let j=0;j<22;j++){
      const x=(r()-.5)*1.15,z=(r()-.5)*.74
      if(sand&&variant===1)b.puff(pt(x,.12,z),pt(.035,.014,.026),tint(j%2?'#efe1c3':'#ac9577'),0,.15)
      if(!sand||variant===2)b.blade(x,z,.11,.025,.17,.3,tint(sand?'#c1a87b':'#b7dbc9'))
    }
  }
  return b.finish()
}

