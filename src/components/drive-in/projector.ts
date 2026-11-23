import * as T from 'three'
import { face, seeded, texture } from './geometry'

function intermission(c:CanvasRenderingContext2D,title:string) {
  const {width:w,height:h}=c.canvas
  const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#324456');sky.addColorStop(.48,'#ac827a');sky.addColorStop(1,'#e4b184')
  c.fillStyle=sky;c.fillRect(0,0,w,h)
  c.fillStyle='#efd8b4';c.beginPath();c.arc(w*.69,h*.34,h*.115,0,Math.PI*2);c.fill()
  const r=seeded(156)
  for(let layer=0;layer<3;layer++){
    c.beginPath();c.moveTo(0,h)
    for(let x=-10;x<w+14;x+=12) c.lineTo(x,h*(.49+layer*.105)+Math.sin(x*.012+layer*2.6)*h*.039+Math.sin(x*.005+layer)*h*.075+r()*h*.025)
    c.lineTo(w,h);c.closePath();c.fillStyle=['#747480','#576975','#344c58'][layer];c.fill()
  }
  c.fillStyle='#f6ebd8';c.font='19px monospace';c.fillText('OUT OF OFFICE   /   PICTURES',w*.057,h*.13)
  c.font='italic '+Math.round(h*.17)+'px Georgia';c.fillText(title||'Intermission',w*.052,h*.87,w*.90)
}
export function projector(p:T.Object3D,frame:{x:number;y:number;z:number;w:number;h:number}) {
  let ctx!:CanvasRenderingContext2D
  const map=texture(1200,612,c=>{ctx=c;intermission(c,'Intermission')})
  const {x,y,z,w,h}=frame
  const screen=face(p,x,y,z+.034,w,h,map)
  screen.material.transparent=false;screen.material.fog=false
  const reflectionMat=new T.ShaderMaterial({
    uniforms:{poster:{value:map}},transparent:true,depthWrite:false,
    vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 v;uniform sampler2D poster;
      float rand(float n){return fract(sin(n*12.9898)*43758.5453);}
      void main(){float line=rand(floor(v.y*310.));float ripple=sin(v.y*500.+v.x*9.)*.012+line*.025;
      vec2 q=vec2(v.x+ripple,v.y);vec3 c=texture2D(poster,clamp(q,.002,.998)).rgb;
      float edge=smoothstep(0.,.12,v.x)*smoothstep(0.,.12,1.-v.x);
      gl_FragColor=vec4(c,.25*edge*v.y*(.28+.72*line));
      #include <colorspace_fragment>
    }`
  })
  const mirror=new T.Mesh(new T.PlaneGeometry(w*1.11,7.6),reflectionMat)
  mirror.rotation.x=-Math.PI/2;mirror.position.set(x,.018,z+4);p.add(mirror)
  let generation=0,activeImage:HTMLImageElement|null=null
  function set(url:string|null,title:string) {
    const token=++generation
    if(activeImage){activeImage.onload=null;activeImage.onerror=null}
    intermission(ctx,title);map.needsUpdate=true
    if(!url)return
    const img=new Image();activeImage=img;img.crossOrigin='anonymous';img.decoding='async'
    img.onload=()=>{
      if(token!==generation)return
      const w=ctx.canvas.width,h=ctx.canvas.height,scale=Math.min(w/img.naturalWidth,h/img.naturalHeight)
      ctx.fillStyle='#202831';ctx.fillRect(0,0,w,h)
      ctx.drawImage(img,(w-img.naturalWidth*scale)/2,(h-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale)
      map.needsUpdate=true
    }
    img.src=url
  }
  return {set,dispose(){generation++;if(activeImage){activeImage.onload=null;activeImage.onerror=null}map.dispose()}}
}
