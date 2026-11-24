import * as T from 'three'
import { glowTexture, texture } from '../drive-in/geometry'
import { display } from './pixelscapeEffects'
import type { Area } from './world'
export { cafeWindowRain, rainField } from './pixelscapeEffects'

function practical(scene:T.Scene,name:string,color:string,power:number,radius:number,x:number,y:number,z:number){
  const light=new T.PointLight(color,power,radius,2)
  light.name=name
  light.position.set(x,y,z)
  scene.add(light)
  return light
}

type Position = [number, number, number]

function pendant(scene:T.Scene,name:string,color:string,candela:number,from:Position,to:Position,angle=.87){
  const light=new T.SpotLight(color,candela,7.2,angle,.88,2)
  light.name=name
  light.position.set(...from)
  light.target.position.set(...to)
  scene.add(light,light.target)
}

// Diffusion is attached to the physical luminous face. Opaque leaves, passers-by
// and the architecture still occlude it, including in the reflection camera.
function luminousFace(scene:T.Scene, map:T.Texture, name:string, at:Position, width:number, height:number, tint:string, strength:number) {
  const material=new T.MeshBasicMaterial({
    map,color:tint,opacity:strength,transparent:true,depthWrite:false,side:T.DoubleSide,
    blending:T.AdditiveBlending,toneMapped:false,
  })
  const glow=new T.Mesh(new T.PlaneGeometry(width,height),material)
  glow.name=name;glow.position.set(...at);glow.renderOrder=2
  scene.add(glow)
}

function gardenWindowLight(scene:T.Scene) {
  // Map the four real east panes and their mullions onto the red quarry tiles.
  // The penumbra grows away from the glass. The transparent patch leaves the
  // mortar joints and the objects sitting on the floor visible through the light.
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute([
    1.89,.037,-4.52, 5.98,.037,-4.52, 4.16,.037,.08, -.38,.037,.08,
  ],3))
  geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2))
  geometry.setIndex([0,2,1,0,3,2])
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`
      varying vec2 pane;
      void main(){pane=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:`
      varying vec2 pane;
      void main(){
        float farEdge = smoothstep(0.,.11,pane.y)*(1.-smoothstep(.54,1.,pane.y));
        float jamb = min(pane.x,1.-pane.x);
        float aperture = smoothstep(0.,.035+.055*pane.y,jamb);
        float vertical = abs(fract(pane.x*4.)-.5);
        float rails = 1. - .40*smoothstep(.40-.13*pane.y,.50,vertical);
        float bars = abs(fract(.90+pane.y*2.48)-.5);
        float shadow = 1.-.22*(1.-smoothstep(.008,.04+.06*pane.y,bars));
        gl_FragColor=vec4(.055,.25,.53,.32*farEdge*aperture*rails*shadow);
        #include <colorspace_fragment>
      }
    `,
  })
  const spill=new T.Mesh(geometry,material)
  spill.name='Rain-blue glass on quarry tiles'; scene.add(spill)
}

export function furnishLight(scene:T.Scene,area:Area){
  const street=area==='street',cafe=area==='cafe'
  scene.background=new T.Color(street?'#203c60':cafe?'#182439':'#253c53')
  if(street)scene.fog=new T.Fog('#294b70',26,90)
  const sky=new T.HemisphereLight(
    cafe?'#accaff':'#94bef7',cafe?'#806066':street?'#526483':'#6b606e',
    cafe?1.18:street?1.18:1.48,
  )
  sky.name='Rain sky and reflected pavement light'
  scene.add(sky)
  const key=new T.DirectionalLight(cafe?'#ffe1bd':street?'#a3beef':'#a4d7ff',cafe?.78:street?1.08:1.36)
  key.name=cafe?'Warm reflected ceiling light':'Moonlight through rain clouds'
  key.position.set(cafe?-2.8:-5,cafe?9:12,street?6:cafe?-3.5:-6)
  scene.add(key,key.target)
  key.castShadow=true;key.shadow.mapSize.set(1024,1024)
  const extent=street?16:9
  Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.2,far:60})
  key.shadow.bias=-.00027;key.shadow.normalBias=.019
  const fill=new T.DirectionalLight(cafe?'#a5b9e4':street?'#839be5':'#a9b3e5',cafe?.72:street?.61:.76)
  fill.position.set(5,3,6);scene.add(fill)
  const diffusion=glowTexture()
  if(street){
    practical(scene,'Forest window behind perforated screen','#ffc38e',15,5.4,-13.90,1.68,-1.43)
    practical(scene,'Forest recessed entrance','#ffd28e',16,6.4,-10.74,1.90,-.92)
    practical(scene,'Forest upper inhabited room','#ffca97',7.4,3.9,-12.04,4.2,-1.66)
    practical(scene,'Vending window spill','#a7e3ff',10,4.6,8.10,1.46,.73)
    practical(scene,'Tea shop eave','#ffbf84',15,6.0,15.13,2.12,.16)
    practical(scene,'Azuma house recessed entrance','#ffd09a',5.6,4.2,0,1.99,-.57)
    for(const x of [-14.16,-12.55,-10.77,-9.15]){
      luminousFace(scene,diffusion,'Humidity around cafe shelf light',[x,2.09,-2.17],1.48,.38,'#ffb57e',.24)
    }
    luminousFace(scene,diffusion,'Lacquered beverage case',[8.10,1.49,.615],1.10,.86,'#aadfff',.13)
  }else if(cafe){
    // A broad paper ceiling and three smaller enamel shades have distinct jobs.
    pendant(scene,'Light through the shoji ceiling','#ffce9a',25,[-3.1,3.23,-1.20],[-3.1,.06,-1.2],1.21)
    for(const x of [-5.15,-3.45,-1.75]){
      pendant(scene,'Enamel bar shade','#ffce91',10.0,[x,2.46,-2.35],[x,1.03,-1.65],.67)
      luminousFace(scene,diffusion,'Diffusion under enamel shade',[x,2.454,-2.27],.67,.19,'#ffc088',.31)
    }
    pendant(scene,'Rain light through east windows','#91c3ff',17,[4.06,2.43,-4.48],[2.35,.60,-1.06],1.05)
    gardenWindowLight(scene)
  }else{
    practical(scene,'Paper lamp and cedar surround','#ffbc85',15,6.4,-3.45,1.17,-1.1)
    luminousFace(scene,diffusion,'Washi fibres against wet glass',[-3.45,1.19,-1.42],1.65,1.67,'#ffad75',.37)
    pendant(scene,'East reading downlight','#ffc293',14,[3.90,3.20,.56],[3.55,.06,.37])
    practical(scene,'Blue court light returning through the sill','#91c7ff',9.2,6,1.90,1.80,-3.46)
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
