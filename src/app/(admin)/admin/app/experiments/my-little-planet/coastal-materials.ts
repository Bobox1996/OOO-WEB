import * as T from 'three/webgpu'
import { attribute, cameraPosition, dot, exp, float, mix, normalWorld, positionLocal, positionWorld, screenUV, sin, time, transformNormalToView, uniform, vec2, vec3, texture, viewportSharedTexture } from 'three/tsl'
import { clamp, random } from './world'

export const seaWind=new T.Vector3(.84,.13,-.51).normalize()
const foliageColor=()=>attribute<'vec3'>('color','vec3')
function dataMap(bytes:Uint8Array,size:number){
  const tex=new T.DataTexture(bytes,size,size,T.RGBAFormat)
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter
  tex.generateMipmaps=true;tex.needsUpdate=true;return tex
}
// Tileable wave slopes, caustic cell ridges and a mineral-grain channel in one shared texture.
function makeCoastMap(){
  const size=192,cells=9,arr=new Uint8Array(size*size*4),rng=random(385)
  const points=Array.from({length:cells*cells},()=>[.18+rng()*.62,.18+rng()*.62])
  const at=(x:number,y:number)=>points[((y%cells+cells)%cells)*cells+(x%cells+cells)%cells]
  const wave=(u:number,v:number)=>{
    const x=u*Math.PI*2,y=v*Math.PI*2,warp=.72*Math.sin(x+y)+.33*Math.sin(2*x-y)
    return .50*Math.sin(2*x+3*y+warp)+.26*Math.sin(4*x-2*y+warp)+.15*Math.sin(6*y+x-.5*warp)+.09*Math.sin(8*x+4*y)
  }
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const u=i/size,v=j/size,dx=(wave(u+.002,v)-wave(u-.002,v))*6.5,dy=(wave(u,v+.002)-wave(u,v-.002))*6.5
    const x=u*cells+.26*Math.sin(v*6.283),y=v*cells+.25*Math.cos(u*6.283)
    const a=Math.floor(x),b=Math.floor(y);let d1=8,d2=8
    for(let jj=-1;jj<=1;jj++)for(let ii=-1;ii<=1;ii++){
      const q=at(a+ii,b+jj),dist=Math.hypot(a+ii+q[0]-x,b+jj+q[1]-y)
      if(dist<d1){d2=d1;d1=dist}else if(dist<d2)d2=dist
    }
    const k=4*(j*size+i);arr[k]=Math.round(255*clamp(.5+dx));arr[k+1]=Math.round(255*clamp(.5+dy));arr[k+2]=Math.round(255*Math.pow(clamp(1-(d2-d1)*4.4),2.3));arr[k+3]=Math.round(255*rng())
  }
  return dataMap(arr,size)
}
// One seamless tile records sward, granular sand, stone inclusions and moss independently.
function makeGroundMap(){
  const size=256,rng=random(1792),bytes=new Uint8Array(size*size*4)
  for(let i=0;i<bytes.length;i+=4){
    const grain=rng()
    bytes[i]=104+grain*32;bytes[i+1]=103+grain*53;bytes[i+2]=111+rng()*28;bytes[i+3]=114+rng()*26
  }
  function dotPixel(x:number,y:number,channel:number,value:number,blend:number){
    const j=4*((Math.floor(y)&255)*size+(Math.floor(x)&255))+channel
    bytes[j]+=(value-bytes[j])*blend
  }
  for(let k=0;k<7900;k++){
    const x=rng()*size,y=rng()*size,a=rng()*6.28,h=2+rng()*10,light=100+rng()*108
    const bend=rng()*.9-.45
    for(let j=0;j<h;j++){const f=j/h,px=x+Math.cos(a+bend*f)*j,py=y+Math.sin(a+bend*f)*j
      dotPixel(px+1,py+1,0,68,.54*(1-f));dotPixel(px,py,0,light+14*f,.82-.23*f)
    }
  }
  for(let k=0;k<3100;k++){
    const x=rng()*size,y=rng()*size,rx=.45+rng()**3*4.5,ry=rx*(.38+.47*rng()),v=82+rng()*100
    for(let dy=-Math.ceil(ry);dy<=ry;dy++)for(let dx=-Math.ceil(rx);dx<=rx;dx++){
      const d=dx*dx/(rx*rx)+dy*dy/(ry*ry)
      if(d<1){dotPixel(x+dx,y+dy,1,v+33*(1-d)-dy*9,.82);dotPixel(x+dx,y+dy,2,v+29*(1-d),.80)}
    }
  }
  for(let k=0;k<490;k++){
    const x=rng()*size,y=rng()*size,r=1+rng()**2*8,h=rng()*86+70
    for(let j=0;j<r*r;j++){const a=rng()*6.283,rr=Math.sqrt(rng())*r;dotPixel(x+Math.cos(a)*rr,y+Math.sin(a)*rr,3,h+rng()*42,.68)}
  }
  return dataMap(bytes,size)
}
export function coastalMaterials(){
  const map=makeCoastMap(),micro=makeGroundMap(),activity=uniform(matchMedia('(prefers-reduced-motion: reduce)').matches?.32:1)
  const clock=time.mul(activity),coord=vec2(positionLocal.x.add(positionLocal.z.mul(.57)),positionLocal.y.add(positionLocal.z.mul(.88)))
  const fine=texture(map,coord.mul(.82)),drift=vec2(clock.mul(.013),clock.mul(-.009))
  const c1=texture(map,coord.mul(.32).add(drift)),c2=texture(map,coord.mul(.39).sub(drift.mul(.67)))
  const depth=attribute<'float'>('waterDepth','float'),river=attribute<'float'>('riverWeight','float'),bedColor=foliageColor()
  const substrate=texture(micro,coord.mul(.78)),macro=texture(micro,coord.mul(.16))
  const cover=attribute<'float'>('grassCover','float')
  const grains=substrate.g.mul(.72).add(.63)
  const grass=substrate.r.mul(1.16).add(.40).mul(macro.a.mul(.64).add(.69))
  const ground=new T.MeshStandardNodeMaterial({roughness:.82,metalness:0})
  const under=depth.smoothstep(.005,.13),fade=float(1).sub(depth.smoothstep(.35,2.0))
  const caustic=c1.b.mul(c2.b.mul(.75).add(.25)).mul(under).mul(fade)
  ground.colorNode=bedColor.mul(mix(grains,grass,cover)).mul(fine.a.mul(.14).add(.93)).mul(float(1).add(caustic.mul(.72)))
  ground.roughnessNode=mix(float(.9),float(.62),under)
  const sea=new T.MeshStandardNodeMaterial({transparent:true,depthWrite:false,roughness:.22,metalness:0})
  const deep=depth.max(0),shore=deep.smoothstep(.008,.12)
  const flow=attribute<'vec3'>('currentDirection','vec3')
  const axis=dot(positionLocal,flow)
  const waterUv=coord.mul(.215).add(vec2(axis.mul(river).mul(.12),float(0)))
  const first=texture(map,waterUv.add(drift)),second=texture(map,waterUv.mul(2.17).sub(drift.mul(1.47)))
  const slopes=first.rg.sub(.5).mul(.85).add(second.rg.sub(.5).mul(.32))
  const localUp=positionLocal.normalize(),guide=vec3(.17,.86,.44)
  const tang=guide.cross(localUp).add(vec3(.00001,0,.000012)).normalize(),bit=localUp.cross(tang).normalize()
  const amount=mix(float(.27),float(.12),river).mul(shore.mul(.7).add(.3))
  const n=localUp.add(tang.mul(slopes.x.mul(amount))).add(bit.mul(slopes.y.mul(amount))).normalize()
  sea.normalNode=transformNormalToView(n)
  const eye=cameraPosition.sub(positionWorld).normalize(),face=normalWorld.dot(eye).clamp(.025,1)
  const fresnel=float(.024).add(float(.76).mul(float(1).sub(face).pow(4)))
  const distortion=slopes.mul(deep.clamp(0,.88)).mul(.0047).mul(face)
  const refracted=viewportSharedTexture(screenUV.add(distortion).clamp(.002,.998)).rgb
  const path=deep.mul(mix(float(1),float(1.65),river)).div(face.mul(.70).add(.36))
  const absorption=vec3(exp(path.mul(-1.12)),exp(path.mul(-.36)),exp(path.mul(-.26)))
  const tint=mix(vec3(.023,.227,.216),vec3(.034,.218,.162),river)
  const waterBody=refracted.mul(absorption).add(tint.mul(vec3(1,1,1).sub(absorption)))
  const sky=mix(vec3(.20,.41,.45),vec3(.40,.57,.54),float(1).sub(face))
  const water=mix(waterBody,sky,fresnel.mul(mix(float(.82),float(.42),river)))
  const foamNoise=first.b.mul(.52).add(second.b.mul(.36)).add(first.r.mul(.12))
  const edge=float(1).sub(deep.smoothstep(.012,.20)),crest=sin(deep.mul(38).sub(clock.mul(1.25)).add(first.g.mul(6))).mul(.5).add(.5)
  const foam=edge.mul(foamNoise.smoothstep(.25,.72)).mul(crest.smoothstep(.48,.9)).mul(mix(float(.72),float(.29),river))
  // The refracted colour already contains the opaque scenery. Use a lit specular lobe over that base.
  sea.colorNode=vec3(.002,.006,.006)
  sea.emissiveNode=mix(water,vec3(.79,.83,.71),foam)
  sea.roughnessNode=mix(float(.19),float(.39),foam)
  sea.opacityNode=deep.smoothstep(-.012,.035).mul(deep.smoothstep(.025,1.35).mul(.48).add(.47));sea.maskNode=depth.greaterThan(-.012)
  sea.positionNode=positionLocal.add(localUp.mul(sin(axis.mul(3.4).add(clock.mul(.81))).mul(.012).mul(deep.smoothstep(.03,.55))))
  const plant=new T.MeshStandardNodeMaterial({roughness:.86,side:T.DoubleSide}),rock=new T.MeshStandardNodeMaterial({roughness:.84})
  const pos=positionLocal,up=pos.normalize(),wind=vec3(seaWind.x,seaWind.y,seaWind.z),tangent=wind.sub(up.mul(dot(up,wind)))
  const phase=dot(pos,wind),weight=attribute<'float'>('windWeight','float'),twig=attribute<'float'>('flutter','float')
  const gust=sin(phase.mul(.60).sub(clock.mul(1.52))).mul(.55).add(sin(phase.mul(1.31).sub(clock.mul(2.38))).mul(.23)).add(.36)
  const flick=sin(phase.mul(8).add(pos.y.mul(3.3)).sub(clock.mul(4.3))).mul(twig).mul(.022)
  plant.positionNode=pos.add(tangent.mul(gust.mul(weight).add(flick))).add(up.mul(gust.mul(weight).abs().mul(-.13)))
  plant.colorNode=foliageColor().mul(fine.a.mul(.08).add(.97))
  const fleck=texture(map,coord.mul(2.7)).a,grain=fleck.smoothstep(.64,.82).mul(.20).add(fleck.mul(.11)).add(.88)
  const stoneTex=texture(micro,coord.mul(1.35)),rawPos=attribute<'vec3'>('position','vec3')
  const seam=sin(rawPos.y.mul(58).add(stoneTex.a.mul(8)).add(rawPos.x.mul(7))).smoothstep(.80,1)
  rock.colorNode=foliageColor().mul(grain).mul(stoneTex.b.mul(.76).add(.59)).mul(seam.mul(.13).add(.95))
  rock.roughnessNode=float(.79).add(fleck.mul(.14));rock.side=T.DoubleSide
  return {ground,sea,plant,rock,dispose(){map.dispose();micro.dispose();ground.dispose();sea.dispose();plant.dispose();rock.dispose()}}
}
