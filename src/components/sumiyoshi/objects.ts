import * as T from 'three'
import { getImageProps } from 'next/image'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { glowTexture, texture } from '../drive-in/geometry'
import { homeDisplay as display, type Area } from './world'
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

function softbox(scene:T.Scene,name:string,color:string,radiance:number,width:number,height:number,from:Position,to:Position) {
  const source=new T.RectAreaLight(color,radiance,width,height)
  source.name=name
  source.position.set(...from)
  source.lookAt(...to)
  scene.add(source)
}

function rugContact(scene:T.Scene) {
  // Occlusion under the three low bases. Keep it on the wool itself, so raking
  // light still describes the furniture above the soft grounded outlines.
  const width=7.85,depth=4.98,cx=-.65,cz=.08
  const map=texture(512,324,ctx=>{
    ctx.scale(512/width,324/depth)
    const bases=[
      [0,1.22,3.04,1.04,0,.12],[-.71,-.48,1.50,.78,0,.065],
      [-3.30,-1.03,1.46,1.08,-.63,.41],
    ]
    for(const [x,z,w,d,angle,r] of bases){
      ctx.save()
      ctx.translate(x-cx+width/2,z-cz+depth/2);ctx.rotate(angle)
      ctx.fillStyle='rgba(32,24,24,.40)'
      ctx.shadowColor='rgba(29,21,24,.70)';ctx.shadowBlur=11
      ctx.beginPath();ctx.roundRect(-w/2,-d/2,w,d,r);ctx.fill()
      ctx.restore()
    }
  })
  const shade=new T.Mesh(new T.PlaneGeometry(width,depth),new T.MeshBasicMaterial({
    map,transparent:true,depthWrite:false,toneMapped:false,
  }))
  shade.name='Soft contact beneath the furniture'
  shade.rotation.x=-Math.PI/2;shade.position.set(cx,.036,cz);scene.add(shade)
}

function listeningRoomLight(scene:T.Scene) {
  scene.background=new T.Color('#384e62')
  RectAreaLightUniformsLib.init()

  // Plaster and wool return a soft amber light to the ceiling and leeward
  // faces of the cabinetry. The much larger seaward opening is cool silver.
  const bounce=new T.HemisphereLight('#f4e4cd','#b3937e',.76)
  bounce.name='Reflected light from plaster and oat wool'
  scene.add(bounce)
  softbox(scene,'Overcast sea through the picture window','#c0ddf0',1.77,7.2,1.95,
    [1.36,1.88,-3.84],[.35,1.47,2.44])
  const key=new T.DirectionalLight('#dce4e9',.82)
  key.name='Low silver light across the sill'
  key.position.set(2.22,3.54,-8.1)
  key.target.position.set(-1.65,.45,2.7)
  key.castShadow=true
  key.shadow.mapSize.set(1024,1024)
  Object.assign(key.shadow.camera,{left:-7,right:7,top:5,bottom:-5,near:.15,far:22})
  key.shadow.bias=-.00024;key.shadow.normalBias=.011
  scene.add(key,key.target)

  // Linear, recessed emitter and its first bounce along the oak panels.
  // Using the full length spreads the reflection across the veneer and rug.
  softbox(scene,'Concealed ribbon inside the hearth','#ffc184',11.5,2.22,.12,
    [-3.91,.38,-3.48],[-3.90,.26,.5])
  softbox(scene,'Warm hearth grazing the veneer','#ffcc9b',3.05,2.83,.30,
    [-3.91,.44,-2.98],[-3.91,1.38,-3.46])
  pendant(scene,'Light below the black mushroom shade','#ffda9d',.60,
    [-.98,.557,-.24],[-.98,.18,-.24],1.26)
  practical(scene,'Frosted brass reading lamp','#ffc87f',1.48,2.8,-2.09,.355,-1.38)
  rugContact(scene)
  return key
}

export function furnishLight(scene:T.Scene,area:Area){
  if(area==='home')return listeningRoomLight(scene)
  const street=area==='street',cafe=area==='cafe'
  scene.background=new T.Color(street?'#203c60':'#182439')
  if(street)scene.fog=new T.Fog('#294b70',26,90)
  const sky=new T.HemisphereLight(
    cafe?'#accaff':'#94bef7',cafe?'#806066':'#526483',1.18,
  )
  sky.name='Rain sky and reflected pavement light'
  scene.add(sky)
  const key=new T.DirectionalLight(cafe?'#ffe1bd':'#a3beef',cafe?.78:1.08)
  key.name=cafe?'Warm reflected ceiling light':'Moonlight through rain clouds'
  key.position.set(cafe?-2.8:-5,cafe?9:12,street?6:-3.5)
  scene.add(key,key.target)
  key.castShadow=true;key.shadow.mapSize.set(1024,1024)
  const extent=street?16:9
  Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.2,far:60})
  key.shadow.bias=-.00027;key.shadow.normalBias=.019
  const fill=new T.DirectionalLight(cafe?'#a5b9e4':'#839be5',cafe?.72:.61)
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
  }else{
    // A broad paper ceiling and three smaller enamel shades have distinct jobs.
    pendant(scene,'Light through the shoji ceiling','#ffce9a',25,[-3.1,3.23,-1.20],[-3.1,.06,-1.2],1.21)
    for(const x of [-5.15,-3.45,-1.75]){
      pendant(scene,'Enamel bar shade','#ffce91',10.0,[x,2.46,-2.35],[x,1.03,-1.65],.67)
      luminousFace(scene,diffusion,'Diffusion under enamel shade',[x,2.454,-2.27],.67,.19,'#ffc088',.31)
    }
    pendant(scene,'Rain light through east windows','#91c3ff',17,[4.06,2.43,-4.48],[2.35,.60,-1.06],1.05)
    gardenWindowLight(scene)
  }
  return key
}

export function television(room:T.Scene){
  const picture=document.createElement('div')
  picture.dataset.tvPicture=''
  picture.setAttribute('aria-hidden','true')
  // Write a transparent, depth-tested opening in the low-resolution scene.
  // The original photograph sits behind it. People and furniture can still occlude it.
  const face=new T.Mesh(new T.PlaneGeometry(display.width,display.height),new T.ShaderMaterial({
    blending:T.NoBlending,
    vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'void main(){gl_FragColor=vec4(0.0);}',
  }))
  face.name='Television_ProjectDisplay'
  face.material.name='Television_ActiveProject'
  face.position.set(display.x,display.y,display.z);room.add(face)
  const emitters=[-.88,.88].map((offset,i)=>practical(room,'Television spill '+(i+1),'#b6dacf',2,5.8,
    display.x+offset,display.y-.39,display.z+.332))
  const sample=document.createElement('canvas')
  sample.width=12;sample.height=6
  const small=sample.getContext('2d',{willReadFrequently:true})
  const pixel=new T.Color()
  function refresh(img?:HTMLImageElement){
    if(!small)return
    if(img){
      const scale=Math.max(display.width/img.naturalWidth,display.height/img.naturalHeight)
      const sw=display.width/scale,sh=display.height/scale
      small.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,0,0,sample.width,sample.height)
    }else{
      small.fillStyle='#232f2e';small.fillRect(0,0,sample.width,sample.height)
    }
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
      const caption=document.createElement('span')
      caption.textContent=title||'Out Of Office';picture.replaceChildren(caption);refresh()
    }
    if(!url){slate();return}
    const img=new Image();source=img;img.decoding='async'
    // Use the site's responsive image service so the opening TV does not wait
    // for a full print-resolution upload. Offline covers already have local URLs.
    const {props}=getImageProps({src:url,alt:'',width:1600,height:900,sizes:'(max-width: 700px) 100vw, 85vw'})
    let originalFallback=false
    img.onload=()=>{
      if(id!==sequence)return
      img.alt='';picture.replaceChildren(img)
      const displayed=new URL(img.currentSrc,document.baseURI)
      refresh(displayed.origin===location.origin||displayed.protocol==='data:'?img:undefined)
    }
    img.onerror=()=>{
      if(id!==sequence)return
      if(!originalFallback && props.src!==url){
        originalFallback=true;img.removeAttribute('srcset');img.src=url
      }else slate()
    }
    if(props.srcSet){img.sizes=props.sizes||'85vw';img.srcset=props.srcSet}
    img.src=props.src
  }
  set(null,'Out Of Office')
  return {face,picture,set,dispose(){sequence++;if(source){source.onload=null;source.onerror=null}picture.remove()}}
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
