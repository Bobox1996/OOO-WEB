import * as T from 'three'
import { npcPositions, type Area, type Point } from './world'

export type Mode='seated'|'focus'|'walk'|'talk'|'vendor'|'bottle'
export type View={area:Area;mode:Mode;member:number}
export const opening:View={area:'home',mode:'seated',member:0}

export function cameraDirector(camera:T.PerspectiveCamera){
  const eye=new T.Vector3(),aim=new T.Vector3(),target=new T.Vector3()
  let snap=true,high=false
  return {
    cut(){snap=true}, elevation(){high=!high},
    frame(view:View,player:Point,dt:number,reduced:boolean,reading=false){
      const {area,mode,member}=view,{x,z}=player
      const a=camera.aspect,portrait=a<.87
      let fov=48
      if(mode==='seated'){
        eye.set(portrait?-.32:-.67,portrait?1.38:1.37,portrait?4.40:3.85)
        aim.set(portrait?.08:.03,portrait?1.06:1.40,-2.45)
        fov=portrait?T.MathUtils.radToDeg(2*Math.atan(2.06/(6.8*a))):48
      }else if(mode==='focus'){
        // A first-person lean toward the set. The entire display and a leafy margin stay in frame.
        const vfov=portrait?51:43
        const widthFraction=reading&&portrait?.92:.80
        const dist=1.66/(Math.tan(T.MathUtils.degToRad(vfov*.5))*a*widthFraction)
        eye.set(.0,1.58,-2.4+Math.max(dist,2.80));aim.set(0,1.59,-2.4);fov=vfov
      }else if(mode==='talk'){
        const p=npcPositions[member],side=member===0||member===1?1:member===5?1:-1
        const dz=member<2?.05:1.55
        eye.set(p.x+side*(member<2?2.24:1.34),1.65,p.z+dz)
        aim.set(p.x,portrait?.96:1.06,p.z);fov=portrait?53:43
      }else if(mode==='vendor'||mode==='bottle'){
        eye.set(8.25,1.58,portrait?3.95:3.12);aim.set(8.1,1.26,.15);fov=portrait?49:43
      }else if(area==='street'){
        const scale=portrait?1.20:1
        if(high&&!portrait){
          const d=Math.max(29,26/(a*Math.tan(T.MathUtils.degToRad(21))))
          eye.set(.06*x,d*.47,1+d*.88);aim.set(0,1.65,-.3);fov=42
        }else{
          eye.set(x*.98+1.15,(high?12:6.2)*scale,z*.40+(high?12:10.3)*scale)
          aim.set(x*.98,high?.9:1.68,z*.36-.98);fov=portrait?60:49
        }
      }else{
        const home=area==='home',pull=portrait?1.18:1
        eye.set(x*.62,(high?9.4:home?5.7:7.0)*pull,z*.47+(home?6.7:8.0)*pull)
        aim.set(x*.75,.63,z*.57-.57);fov=portrait?60:51
      }
      const t=snap||reduced?1:1-Math.exp(-dt*6.8)
      camera.position.lerp(eye,t);target.lerp(aim,t);camera.lookAt(target)
      camera.fov=T.MathUtils.lerp(camera.fov,T.MathUtils.clamp(fov,28,94),t);camera.updateProjectionMatrix();snap=false
    },
  }
}
