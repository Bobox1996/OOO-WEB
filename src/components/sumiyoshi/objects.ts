import * as T from 'three'
import { texture } from '../drive-in/geometry'
import { display } from './pixelscapeEffects'
import type { Area } from './world'
export { rainField } from './pixelscapeEffects'

function practical(scene:T.Scene,name:string,color:string,power:number,radius:number,x:number,y:number,z:number){
  const light=new T.PointLight(color,power,radius,2)
  light.name=name
  light.position.set(x,y,z)
  scene.add(light)
  return light
}

function pendant(scene:T.Scene,name:string,color:string,candela:number,from:[number,number,number],to:[number,number,number]){
  const light=new T.SpotLight(color,candela,5.2,.79,.84,2)
  light.name=name
  light.position.set(...from)
  light.target.position.set(...to)
  scene.add(light,light.target)
}

export function furnishLight(scene:T.Scene,area:Area){
  const street=area==='street',cafe=area==='cafe'
  scene.background=new T.Color(street?'#16404d':cafe?'#172325':'#19363b')
  if(street)scene.fog=new T.Fog('#123240',36,95)
  scene.add(new T.HemisphereLight(cafe?'#bad0d2':'#a1c7d0',cafe?'#58483f':'#365152',cafe?.74:.91))
  const key=new T.DirectionalLight(cafe?'#f4d9b7':'#a4d5df',cafe?.71:street?1.20:1.40)
  key.name=cafe?'Warm reflected ceiling light':'Moonlight through cloud'
  key.position.set(cafe?-2.8:-5,cafe?9:12,street?6:cafe?-3.5:-6)
  scene.add(key,key.target)
  key.castShadow=true;key.shadow.mapSize.set(1024,1024)
  const extent=street?16:9
  Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.2,far:60})
  key.shadow.bias=-.00027;key.shadow.normalBias=.019
  const fill=new T.DirectionalLight(cafe?'#9ac4cf':'#669aaa',cafe?.60:.61)
  fill.position.set(5,3,6);scene.add(fill)
  if(street){
    practical(scene,'Forest window behind perforated screen','#ffe1ad',7.8,4.4,-13.90,1.45,-1.30)
    practical(scene,'Forest recessed entrance','#ffd3a0',8.2,4.5,-10.74,1.68,-.65)
    practical(scene,'Vending window spill','#b1f0de',8,3.8,8.10,1.30,.73)
    practical(scene,'Shop counter light','#ffc07b',15,5.3,14.60,1.81,.36)
    practical(scene,'Genkan light','#ffb872',4.5,3.0,-4.9,1.62,.35)
  }else if(cafe){
    pendant(scene,'Coffee bar pendant','#ffe0b5',9.6,[-3.65,2.52,-1.80],[-3.65,.96,-1.77])
    pendant(scene,'Espresso and porcelain wash','#ffe4bd',7.2,[-4.02,2.49,-3.45],[-4.48,1.06,-4.19])
    pendant(scene,'Reading table shade','#f9dab5',5.0,[3.75,2.46,-1.0],[4.45,.70,-1.56])
  }else{
    practical(scene,'Paper lamp and cedar surround','#ffbc77',8.4,4.9,-3.45,1.19,-1.1)
  }
  return key
}

export function television(room:T.Scene){
  let ctx!:CanvasRenderingContext2D
  const map=texture(1440,810,c=>{ctx=c})
  const face=new T.Mesh(new T.PlaneGeometry(display.width,display.height),new T.MeshBasicMaterial({map,toneMapped:false}))
  face.name='Television_ProjectDisplay'
  face.material.name='Television_ActiveProject'
  face.position.set(0,display.y,display.z);room.add(face)
  const emitters=[-.88,.88].map((x,i)=>practical(room,'Television spill '+(i+1),'#b6dacf',2,5.8,x,1.2,-2.06))
  const emission=[new T.Color(),new T.Color()]
  room.userData.televisionEmission=emission
  const sample=document.createElement('canvas')
  sample.width=12;sample.height=6
  const small=sample.getContext('2d',{willReadFrequently:true})
  const pixel=new T.Color()
  function refresh(){
    map.needsUpdate=true
    room.userData.televisionRevision=(room.userData.televisionRevision||0)+1
    if(!small)return
    small.drawImage(ctx.canvas,0,0,sample.width,sample.height)
    // Average in linear light; each half of the picture lights its own side of the room.
    const patches=small.getImageData(0,0,sample.width,sample.height).data
    for(let half=0;half<2;half++){
      const light=emitters[half]
      light.color.setRGB(0,0,0)
      for(let y=0;y<sample.height;y++)for(let x=half*6;x<half*6+6;x++){
        const i=(y*sample.width+x)*4
        pixel.setRGB(patches[i]/255,patches[i+1]/255,patches[i+2]/255,T.SRGBColorSpace)
        light.color.add(pixel)
      }
      light.color.multiplyScalar(1/36)
      emission[half].copy(light.color)
      const peak=Math.max(.001,light.color.r,light.color.g,light.color.b)
      light.color.multiplyScalar(1/peak)
      light.intensity=peak*12.6
    }
  }
  let sequence=0,source:HTMLImageElement|null=null
  function set(url:string|null,title:string){
    const id=++sequence
    if(source){source.onload=null;source.onerror=null}
    const slate=()=>{
      const {width:w,height:h}=ctx.canvas
      ctx.fillStyle='#232f2e';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f6efd9';ctx.textAlign='center'
      ctx.font='italic 58px Georgia';ctx.fillText(title||'Out Of Office',w/2,h/2,w*.86);refresh()
    }
    if(!url){slate();return}
    const img=new Image();source=img;img.crossOrigin='anonymous';img.decoding='async'
    img.onload=()=>{
      if(id!==sequence)return
      const {width:w,height:h}=ctx.canvas,iw=img.naturalWidth,ih=img.naturalHeight
      // Centered object-fit: cover. Portraits fill the entire 16:9 television.
      const scale=Math.max(w/iw,h/ih),sw=w/scale,sh=h/scale
      ctx.drawImage(img,(iw-sw)/2,(ih-sh)/2,sw,sh,0,0,w,h);refresh()
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
