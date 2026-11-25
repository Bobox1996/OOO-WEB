import * as T from 'three'
import { texture } from './geometry'
import type { Film } from './ProjectDeck'

export function touchscreen(cockpit:T.Object3D) {
  let ctx!:CanvasRenderingContext2D
  const map=texture(768,460,c=>{ctx=c})
  const front=new T.Mesh(new T.PlaneGeometry(.50,.30),new T.MeshBasicMaterial({map,toneMapped:false}))
  front.position.set(.18,1.015+.0014,-.62+.010);front.rotation.x=-8*Math.PI/180
  cockpit.add(front)
  function draw(films:Film[],i:number,poster:HTMLCanvasElement){
    const c=ctx,w=c.canvas.width,h=c.canvas.height
    const rect=(x:number,y:number,width:number,height:number,r:number,color:string)=>{
      c.fillStyle=color;c.beginPath();c.roundRect(x,y,width,height,r);c.fill()
    }
    c.fillStyle='#20333a';c.fillRect(0,0,w,h)
    c.fillStyle='#b4dfcd';c.font='bold 20px monospace';c.fillText('OOO  /  PROJECT DECK',28,39)
    c.textAlign='right';c.fillText(films.length?String(i+1).padStart(2,'0')+'  /  '+String(films.length).padStart(2,'0'):'STANDBY',740,39);c.textAlign='left'
    for(let k=2;k>0;k--){
      const y=59+(2-k)*27
      rect(50+k*10,y,w-100-k*20,100,12,k===2?'#c0b8d0':'#99cab6')
      c.fillStyle='#344747';c.font='bold 16px monospace'
      c.fillText(films.length?(films[(i+k)%films.length].title).toUpperCase():'OUT OF OFFICE',80+k*10,y+20,530)
    }
    rect(39,115,690,277,18,'#f4e6d0')
    c.drawImage(poster,54,131,325,244)
    const film=films[i]
    c.fillStyle='#50635e';c.font='bold 17px monospace';c.fillText(film?.index||'OOO',405,169,280)
    c.font='bold 14px monospace';c.fillText((film?.category||'CINEMA').toUpperCase(),405,194,278)
    c.fillStyle='#24383b';c.font='italic 34px Georgia'
    const words=(film?.title||'Intermission').split(/\s+/)
    let line='',y=249
    for(const word of words){
      if(line&&c.measureText(line+' '+word).width>287){c.fillText(line,405,y,283);line='';y+=36}
      if(y>325)break
      line+=(line?' ':'')+word
    }
    if(line)c.fillText(line,405,y,283)
    c.fillStyle='#51645a';c.font='18px sans-serif';c.fillText('Open project deck  ↗',405,357)
    c.fillStyle='#d5e8d9';c.font='28px sans-serif';c.fillText('‹',51,433);c.fillText('›',707,433)
    c.textAlign='center';c.font='16px monospace';c.fillText('DRIVE-IN  /  OOO',384,430);c.textAlign='left'
    map.needsUpdate=true
  }
  return {mesh:front,draw}
}
