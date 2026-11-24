import * as T from 'three'
import { seeded, texture } from '../drive-in/geometry'
import type { Area } from './world'

export function furnishLight(scene:T.Scene,area:Area){
  const street=area==='street',cafe=area==='cafe'
  const color=street?'#8799a3':cafe?'#343133':'#171f21'
  scene.background=new T.Color(color)
  if(street)scene.fog=new T.Fog('#85959d',31,145)
  scene.add(new T.HemisphereLight(street?'#dbe9ee':cafe?'#ffe7c9':'#dae8db',cafe?'#bc8771':street?'#a69d94':'#7c7d72',street?1.8:cafe?1.48:1.15))
  const sun=new T.DirectionalLight(street?'#fff0d6':cafe?'#ffe3ba':'#e6f2d7',street?2.42:cafe?2.02:2.64)
  sun.position.set(-5,13,street?8:-4);scene.add(sun,sun.target)
  sun.castShadow=true;sun.shadow.mapSize.set(street?1024:1024,1024)
  const extent=street?17:9
  Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.2,far:60})
  sun.shadow.bias=-.00025;sun.shadow.normalBias=.015
  const fill=new T.DirectionalLight(cafe?'#dab79c':street?'#b2c4d8':'#adc1cf',cafe?.72:street?.7:.58)
  fill.position.set(4,4,6);scene.add(fill)
  if(area==='home'){
    const warm=new T.PointLight('#ffc48d',10,7,2);warm.position.set(3,2.1,1);scene.add(warm)
  }
  return sun
}

export function rainField(scene:T.Scene,area:'home'|'street'){
  const inside=area==='home',rand=seeded(inside?655:182)
  const n=inside?440:680,spread=inside?11:50,back=inside?-9.6:-.5,depth=inside?5.4:8.0
  const seeds=Array.from({length:n},()=>[(rand()-.5)*spread,rand()*8,back+rand()*depth,.09+rand()*.18])
  const positions=new Float32Array(n*6),g=new T.BufferGeometry()
  const attr=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage)
  g.setAttribute('position',attr)
  const rainfall=new T.LineSegments(g,new T.LineBasicMaterial({color:'#d9ece7',transparent:true,opacity:inside?.25:.3,depthWrite:false}))
  rainfall.frustumCulled=false;scene.add(rainfall)
  const count=inside?35:62
  const glints=new T.InstancedMesh(new T.RingGeometry(.86,1,12),new T.MeshBasicMaterial({color:'#d4e2da',opacity:.28,transparent:true,depthWrite:false}),count)
  const ripples=Array.from({length:count},()=>[(rand()-.5)*(inside?8.8:45),inside?-3.65+rand()*.62:1+rand()*4.8,rand(),.8+rand()*.6])
  const cursor=new T.Object3D();cursor.rotation.x=-Math.PI/2;glints.frustumCulled=false;scene.add(glints)
  return (time:number)=>{
    for(let i=0;i<n;i++){
      const [x,start,z,size]=seeds[i],y=((start-time*(5.4+size*8))%8+8)%8,j=i*6
      const drift=x+.073*(8-y)
      positions[j]=drift;positions[j+1]=y;positions[j+2]=z;positions[j+3]=drift+.018;positions[j+4]=y-size;positions[j+5]=z
    }
    attr.needsUpdate=true
    for(let i=0;i<count;i++){
      const [x,z,phase,rate]=ripples[i],age=(time*.68*rate+phase)%1,s=age<.7?.01+age*.18:0
      cursor.position.set(x,inside?.11:.040,z);cursor.scale.set(s,s,1);cursor.updateMatrix();glints.setMatrixAt(i,cursor.matrix)
    }
    glints.instanceMatrix.needsUpdate=true
  }
}

export function television(room:T.Scene){
  let ctx!:CanvasRenderingContext2D
  const map=texture(1440,810,c=>{ctx=c})
  const face=new T.Mesh(new T.PlaneGeometry(3.32,1.8675),new T.MeshBasicMaterial({map,toneMapped:false}))
  face.position.set(0,1.59,-2.392);room.add(face)
  let sequence=0,source:HTMLImageElement|null=null
  function set(url:string|null,title:string){
    const id=++sequence
    if(source){source.onload=null;source.onerror=null}
    const slate=()=>{
      const {width:w,height:h}=ctx.canvas
      ctx.fillStyle='#232f2e';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f6efd9';ctx.textAlign='center'
      ctx.font='italic 58px Georgia';ctx.fillText(title||'Out Of Office',w/2,h/2,w*.86);map.needsUpdate=true
    }
    if(!url){slate();return}
    const img=new Image();source=img;img.crossOrigin='anonymous';img.decoding='async'
    img.onload=()=>{
      if(id!==sequence)return
      const {width:w,height:h}=ctx.canvas,iw=img.naturalWidth,ih=img.naturalHeight
      // Centered object-fit: cover. Portraits fill the entire 16:9 television.
      const scale=Math.max(w/iw,h/ih),sw=w/scale,sh=h/scale
      ctx.drawImage(img,(iw-sw)/2,(ih-sh)/2,sw,sh,0,0,w,h);map.needsUpdate=true
    }
    img.onerror=()=>{if(id===sequence)slate()};img.src=url
  }
  set(null,'Out Of Office')
  return {face,set,dispose(){sequence++;if(source){source.onload=null;source.onerror=null}}}
}

export function bottleLabel(parent:T.Object3D,statement:string){
  const stamp=texture(1536,520,c=>{
    c.fillStyle='#f1e5c9';c.fillRect(0,0,1536,520)
    c.fillStyle='#952f28';c.fillRect(0,0,1536,22);c.fillRect(0,498,1536,22)
    c.fillStyle='#1b3d38';c.textAlign='center';c.font='bold 52px Georgia';c.fillText('VISION  /  OOO COLA',768,94)
    c.fillRect(325,115,886,3);c.font='bold 25px Arial'
    const raw=statement.trim()||'OUT OF OFFICE',lines:string[]=[]
    for(const paragraph of raw.split(/\n+/)){
      let line=''
      for(const word of paragraph.trim().split(/\s+/)){if(line&&c.measureText(line+' '+word).width>860){lines.push(line);line=''}line+=(line?' ':'')+word}
      if(line)lines.push(line)
    }
    const spacing=Math.min(37,320/Math.max(lines.length,1))
    c.font='bold '+Math.min(26,spacing*.87)+'px Arial'
    lines.forEach((line,i)=>c.fillText(line,768,154+i*spacing,915))
    c.fillStyle='#952f28';c.font='bold 19px monospace';c.fillText('SUMIYOSHI   •   OUT OF OFFICE DESIGN',768,475)
  })
  const label=new T.Mesh(new T.CylinderGeometry(.0385,.0385,.095,64,1,true),new T.MeshBasicMaterial({map:stamp,toneMapped:false}))
  // The GLB faces +Z. Put the middle of the printed block on the camera-facing meridian.
  label.rotation.y=Math.PI;label.position.y=.124;parent.add(label)
  return label
}
